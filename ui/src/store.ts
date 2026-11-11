import { create } from 'zustand'
import { connect } from './core/connect'
import { background, notifications } from './core/platform'
import type { Account, Contact, Conversation, Core, CoreEvent, Interaction, Member } from './core/types'

export type Theme = 'system' | 'light' | 'dark'

export type Panel =
	| { name: 'share' }
	| { name: 'add' }
	| { name: 'newGroup' }
	| { name: 'groupInfo'; publicKey: string }
	| { name: 'conversationActions'; publicKey: string }
	| { name: 'confirm'; action: ConfirmAction }
	| { name: 'settings'; page: SettingsPage }

export type SettingsPage = 'home' | 'network' | 'servers' | 'blocked' | 'backup' | 'about' | 'inspirations'

/** Ação destrutiva que passa por uma confirmação própria da página. */
export interface ConfirmAction {
	kind: 'hide' | 'leave' | 'block'
	publicKey: string
	/** Conversa do contato, usada ao bloquear. */
	conversationPublicKey?: string
	name: string
}

interface State {
	phase: 'connecting' | 'ready' | 'failed'
	failure: string
	core: Core | null
	online: boolean
	loaded: boolean

	account: Account | null
	contacts: Record<string, Contact>
	conversations: Record<string, Conversation>
	members: Record<string, Record<string, Member>>
	messages: Record<string, Interaction[]>
	/** Conversas cujo histórico antigo já foi todo carregado. */
	exhausted: Record<string, boolean>

	active: string | null
	panel: Panel | null
	theme: Theme
	toast: { id: number; text: string } | null

	/**
	 * Quantos pares este nó enxerga agora, ou null enquanto não se sabe.
	 *
	 * Existe porque o protocolo falha calado: um pedido de contato enviado
	 * fica procurando o outro aparelho em laço, sem erro e sem desistir
	 * (weshnet, contact_request_manager.go). Com o nó isolado, a tela ficaria
	 * idêntica à de quem está só esperando resposta. Zero aqui é a diferença
	 * entre "ninguém respondeu ainda" e "este aparelho não está na rede".
	 */
	peers: number | null

	start(): Promise<void>
	/** Reassina o fluxo de eventos do zero (depois de ocultar, bloquear ou desbloquear). */
	resync(): void
	select(publicKey: string | null): void
	open(panel: Panel | null): void
	setTheme(theme: Theme): void
	notify(text: string): void
}

const VISIBLE = new Set(['TypeUserMessage', 'TypeGroupInvitation'])
const THEME_KEY = 'iparrot.theme'

function readTheme(): Theme {
	try {
		const v = localStorage.getItem(THEME_KEY)
		if (v === 'light' || v === 'dark' || v === 'system') return v
	} catch {
		// armazenamento indisponível: fica no padrão
	}
	return 'system'
}

function applyTheme(theme: Theme) {
	const root = document.documentElement
	if (theme === 'system') root.removeAttribute('data-theme')
	else root.setAttribute('data-theme', theme)
}

/** Insere ou atualiza mantendo a lista ordenada por data de envio. */
function upsert(list: Interaction[] | undefined, incoming: Interaction[]): Interaction[] {
	const byCid = new Map((list ?? []).map(i => [i.cid, i]))
	for (const i of incoming) byCid.set(i.cid, i)
	return [...byCid.values()].sort((a, b) => a.sentDate - b.sentDate || a.cid.localeCompare(b.cid))
}

let toastSeq = 0
let unsubscribe: (() => void) | null = null
let peerTimer: ReturnType<typeof setInterval> | null = null

/** De quanto em quanto tempo se pergunta ao núcleo quantos pares há. */
const PEER_POLL_MS = 15000

export const useStore = create<State>((set, get) => {
	const handle = (ev: CoreEvent) => {
		switch (ev.type) {
			case 'listEnded':
				set({ loaded: true })
				break
			case 'account':
				set({ account: ev.account })
				break
			case 'contact':
				set(s => ({ contacts: { ...s.contacts, [ev.contact.publicKey]: ev.contact } }))
				break
			case 'conversation':
				set(s => ({ conversations: { ...s.conversations, [ev.conversation.publicKey]: ev.conversation } }))
				break
			case 'conversationDeleted':
				set(s => {
					const conversations = { ...s.conversations }
					delete conversations[ev.publicKey]
					return { conversations, active: s.active === ev.publicKey ? null : s.active }
				})
				break
			case 'member':
				set(s => ({
					members: {
						...s.members,
						[ev.member.conversationPublicKey]: {
							...s.members[ev.member.conversationPublicKey],
							[ev.member.publicKey]: ev.member,
						},
					},
				}))
				break
			case 'interaction': {
				const i = ev.interaction
				if (!VISIBLE.has(i.type)) break
				set(s => ({ messages: { ...s.messages, [i.conversationPublicKey]: upsert(s.messages[i.conversationPublicKey], [i]) } }))
				break
			}
			case 'interactionDeleted':
				set(s => ({
					messages: { ...s.messages, [ev.publicKey]: (s.messages[ev.publicKey] ?? []).filter(i => i.cid !== ev.cid) },
				}))
				break
			case 'history': {
				const incoming = (ev.interactions ?? []).filter(i => VISIBLE.has(i.type))
				set(s => ({
					messages: { ...s.messages, [ev.publicKey]: upsert(s.messages[ev.publicKey], incoming) },
					exhausted: { ...s.exhausted, [ev.publicKey]: (ev.interactions ?? []).length === 0 },
				}))
				break
			}
			case 'notification': {
				if (!ev.isNew || !ev.notification.title) break
				// Com a janela à vista, a mensagem já aparece na conversa: basta
				// o aviso curto dentro da página. Escondida, vai para o sistema.
				if (document.visibilityState === 'visible') {
					get().notify(`${ev.notification.title}: ${ev.notification.body}`)
				} else {
					void notifications.show(ev.notification.title, ev.notification.body)
				}
				break
			}
		}
	}

	return {
		phase: 'connecting',
		failure: '',
		core: null,
		online: false,
		loaded: false,
		account: null,
		contacts: {},
		conversations: {},
		members: {},
		messages: {},
		exhausted: {},
		active: null,
		panel: null,
		theme: readTheme(),
		toast: null,
		peers: null,

		async start() {
			applyTheme(get().theme)
			unsubscribe?.()
			set({ phase: 'connecting', failure: '' })
			try {
				const core = await connect()
				set({ core, phase: 'ready' })
				unsubscribe = core.subscribe(handle, online => set({ online }))

				// A chamada é local (o núcleo roda no próprio aparelho), então
				// perguntar de quinze em quinze segundos não custa rede.
				// Falha fica em silêncio de propósito: não saber quantos pares
				// há é bem menos grave do que encher a tela de erro.
				const lerPares = () =>
					void core
						.network()
						.then(n => set({ peers: n.connectedPeers }))
						.catch(() => undefined)
				lerPares()
				if (peerTimer) clearInterval(peerTimer)
				peerTimer = setInterval(lerPares, PEER_POLL_MS)

				if (core.mode === 'p2p') {
					// Pedidos silenciosos: se forem negados, o app segue funcionando
					// e só deixa de avisar com a janela fechada.
					void notifications.request()
					void background.start()
				}
			} catch (err) {
				set({ phase: 'failed', failure: err instanceof Error ? err.message : String(err) })
			}
		},

		resync() {
			const core = get().core
			if (!core) return
			unsubscribe?.()
			set({ loaded: false, contacts: {}, conversations: {}, members: {}, messages: {}, exhausted: {}, active: null })
			unsubscribe = core.subscribe(handle, online => set({ online }))
		},

		select(publicKey) {
			const { core, active } = get()
			if (active && active !== publicKey) void core?.closeConversation(active).catch(() => undefined)
			set({ active: publicKey })
			if (publicKey) void core?.openConversation(publicKey).catch(() => undefined)
		},

		open(panel) {
			set({ panel })
		},

		setTheme(theme) {
			applyTheme(theme)
			try {
				localStorage.setItem(THEME_KEY, theme)
			} catch {
				// sem armazenamento: vale só para esta sessão
			}
			set({ theme })
		},

		notify(text) {
			const id = ++toastSeq
			set({ toast: { id, text } })
			setTimeout(() => {
				if (get().toast?.id === id) set({ toast: null })
			}, 3200)
		},
	}
})

/** Nome a mostrar para uma conversa (contato ou grupo). */
export function conversationName(c: Conversation, contacts: Record<string, Contact>): string {
	if (c.type === 'ContactType') return contacts[c.contactPublicKey]?.displayName || c.displayName || 'Contato'
	return c.displayName || 'Grupo'
}
