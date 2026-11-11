import type {
	Account,
	ExportResult,
	Servers,
	ServersState,
	Contact,
	Conversation,
	Core,
	CoreEvent,
	Interaction,
	Member,
	NetworkInfo,
	ParsedLink,
	ShareInfo,
} from './types'

// Os servidores públicos do Berty, para os quais o weshnet cai quando nada é
// configurado (weshnet/pkg/ipfsutil/consts.go). Aqui são só para a tela de
// demonstração mostrar o mesmo aviso que o app real mostra.
const DEMO_DEFAULT_RDVP = '/ip4/51.15.25.224/udp/4040/quic-v1/p2p/12D3KooWHhDBv6DJJ4XDWjzEXq6sVNEs6VuxsV1WyBBEhPENHzcZ'
const DEMO_DEFAULT_RELAY = '/ip4/51.15.25.224/udp/6363/quic-v1/p2p/12D3KooWAHcEz4K5XAgRDav9fLuhiRY2wuXip385EmT5RoRkCmjr'

/**
 * Núcleo simulado, usado quando a interface abre sem o núcleo Go
 * (navegador comum, prévia de design). Nada sai do navegador.
 */
export class DemoCore implements Core {
	readonly mode = 'demo' as const
	readonly version = 'demo'

	private listeners = new Set<(ev: CoreEvent) => void>()
	private seq = 0
	private account: Account = { publicKey: 'demo-account', displayName: '', link: '' }
	private contacts: Contact[] = []
	private conversations: Conversation[] = []
	private members: Member[] = []
	private interactions: Interaction[] = []
	private blocked: string[] = []
	private demoServers: Servers = { rdvp: [], relays: [] }

	constructor() {
		const now = Date.now()
		const min = 60_000
		const hour = 60 * min

		const addContact = (pk: string, name: string, state: Contact['state'], ago: number) => {
			const conv = `conv-${pk}`
			this.contacts.push({ publicKey: pk, conversationPublicKey: conv, displayName: name, state, createdDate: now - ago, sentDate: now - ago })
			if (state === 'Accepted') {
				this.conversations.push({
					publicKey: conv, type: 'ContactType', displayName: name, link: '', unreadCount: 0,
					lastUpdate: now - ago, createdDate: now - ago, contactPublicKey: pk, accountMemberPublicKey: 'me', isOpen: false, mutedUntil: 0,
				})
			}
			return conv
		}

		const ana = addContact('ana', 'Ana Beatriz', 'Accepted', 26 * hour)
		const rafa = addContact('rafael', 'Rafael Mendes', 'Accepted', 3 * 24 * hour)
		const louro = addContact('louro', 'Louro', 'Accepted', 5 * min)
		addContact('camila', 'Camila Duarte', 'IncomingRequest', 12 * min)
		addContact('jorge', 'Jorge Tavares', 'OutgoingRequestSent', 2 * hour)

		const family = 'conv-familia'
		this.conversations.push({
			publicKey: family, type: 'MultiMemberType', displayName: 'Família', link: '', unreadCount: 2,
			lastUpdate: now - 9 * min, createdDate: now - 30 * 24 * hour, contactPublicKey: '', accountMemberPublicKey: 'me', isOpen: false, mutedUntil: 0,
		})
		for (const [pk, name, isMe, isCreator] of [
			['me', '', true, true],
			['ana', 'Ana Beatriz', false, false],
			['tia-lu', 'Tia Lu', false, false],
			['vo-nena', 'Vó Nena', false, false],
		] as const) {
			this.members.push({ publicKey: pk, conversationPublicKey: family, displayName: name, isMe, isCreator })
		}

		const say = (conv: string, member: string, text: string, ago: number, mine = false) => {
			this.interactions.push({
				cid: `demo-${++this.seq}`, type: 'TypeUserMessage', conversationPublicKey: conv,
				memberPublicKey: mine ? 'me' : member, isMine: mine, acknowledged: mine, sentDate: now - ago, text,
			})
		}

		say(ana, 'ana', 'Chegou bem em Salvador?', 27 * hour)
		say(ana, 'me', 'Cheguei! O ônibus atrasou uma hora em Feira, mas deu tudo certo.', 26.8 * hour, true)
		say(ana, 'ana', 'Que bom. Amanhã te mando as fotos do aniversário.', 26.5 * hour)
		say(ana, 'me', 'Manda sim 🙌', 26 * hour, true)

		say(rafa, 'me', 'Rafa, você tem o contato do eletricista?', 3.2 * 24 * hour, true)
		say(rafa, 'rafael', 'Tenho. Ele atende sábado de manhã, quer que eu combine?', 3.1 * 24 * hour)
		say(rafa, 'me', 'Quero, pode marcar para as 9h.', 3 * 24 * hour, true)

		say(family, 'tia-lu', 'Domingo o almoço é aqui em casa. Quem traz a sobremesa?', 55 * min)
		say(family, 'ana', 'Eu levo o pudim.', 40 * min)
		say(family, 'vo-nena', 'Tragam os meninos cedo para brincar no quintal.', 9 * min)

		say(louro, 'louro', 'Sou o Louro. Tudo que você escrever aqui eu repito. É um jeito rápido de testar o envio de mensagens.', 5 * min)

		this.touch(ana, now - 26 * hour)
		this.touch(rafa, now - 3 * 24 * hour)
		this.touch(louro, now - 5 * min)
	}

	private touch(conv: string, when: number) {
		const c = this.conversations.find(x => x.publicKey === conv)
		if (c) c.lastUpdate = when
	}

	private emit(ev: CoreEvent) {
		for (const l of this.listeners) l(ev)
	}

	private later<T>(value: T, ms = 120): Promise<T> {
		return new Promise(resolve => setTimeout(() => resolve(value), ms))
	}

	subscribe(onEvent: (ev: CoreEvent) => void, onStatus: (online: boolean) => void): () => void {
		this.listeners.add(onEvent)
		const timer = setTimeout(() => {
			onStatus(true)
			onEvent({ type: 'account', isNew: false, account: { ...this.account } })
			for (const contact of this.contacts) onEvent({ type: 'contact', isNew: false, contact: { ...contact } })
			for (const conversation of this.conversations) onEvent({ type: 'conversation', isNew: false, conversation: { ...conversation } })
			for (const member of this.members) onEvent({ type: 'member', isNew: false, member: { ...member } })
			for (const interaction of this.interactions) onEvent({ type: 'interaction', isNew: false, interaction: { ...interaction } })
			onEvent({ type: 'listEnded', isNew: false })
		}, 350)
		return () => {
			clearTimeout(timer)
			this.listeners.delete(onEvent)
		}
	}

	getAccount() {
		return this.later({ ...this.account })
	}

	updateAccount(displayName: string) {
		this.account.displayName = displayName
		this.emit({ type: 'account', isNew: true, account: { ...this.account } })
		return this.later({ ...this.account })
	}

	share(): Promise<ShareInfo> {
		return this.later({
			link: 'IPARROT://PB/DEMO-6Q3:V2K9-ESTE-CODIGO-E-APENAS-ILUSTRATIVO-7HX0.M4TZ',
			displayName: this.account.displayName,
		})
	}

	parseLink(link: string): Promise<ParsedLink> {
		const l = link.trim().toLowerCase()
		if (l.startsWith('iparrot://') || l.startsWith('berty://') || l.startsWith('https://berty.tech/id#')) {
			return this.later({ kind: l.includes('group') ? 'group' : 'contact', displayName: l.includes('group') ? 'Grupo convidado' : 'Novo contato' })
		}
		return Promise.reject(new Error('link não reconhecido'))
	}

	requestContact(_link: string) {
		const pk = `novo-${++this.seq}`
		const contact: Contact = {
			publicKey: pk, conversationPublicKey: `conv-${pk}`, displayName: 'Novo contato',
			state: 'OutgoingRequestSent', createdDate: Date.now(), sentDate: Date.now(),
		}
		this.contacts.push(contact)
		this.emit({ type: 'contact', isNew: true, contact: { ...contact } })
		return this.later(undefined)
	}

	acceptContact(publicKey: string) {
		const contact = this.contacts.find(c => c.publicKey === publicKey)
		if (!contact) return Promise.reject(new Error('contato não encontrado'))
		contact.state = 'Accepted'
		const conversation: Conversation = {
			publicKey: contact.conversationPublicKey, type: 'ContactType', displayName: contact.displayName, link: '',
			unreadCount: 0, lastUpdate: Date.now(), createdDate: Date.now(), contactPublicKey: publicKey,
			accountMemberPublicKey: 'me', isOpen: false, mutedUntil: 0,
		}
		this.conversations.push(conversation)
		this.emit({ type: 'contact', isNew: true, contact: { ...contact } })
		this.emit({ type: 'conversation', isNew: true, conversation: { ...conversation } })
		return this.later(undefined)
	}

	createGroup(displayName: string, contacts: string[]) {
		const pk = `conv-grupo-${++this.seq}`
		const conversation: Conversation = {
			publicKey: pk, type: 'MultiMemberType', displayName, link: '', unreadCount: 0, lastUpdate: Date.now(),
			createdDate: Date.now(), contactPublicKey: '', accountMemberPublicKey: 'me', isOpen: false, mutedUntil: 0,
		}
		this.conversations.push(conversation)
		this.emit({ type: 'conversation', isNew: true, conversation: { ...conversation } })
		const me: Member = { publicKey: 'me', conversationPublicKey: pk, displayName: this.account.displayName, isMe: true, isCreator: true }
		this.members.push(me)
		this.emit({ type: 'member', isNew: true, member: me })
		for (const c of contacts) {
			const contact = this.contacts.find(x => x.publicKey === c)
			if (!contact) continue
			const member: Member = { publicKey: c, conversationPublicKey: pk, displayName: contact.displayName, isMe: false, isCreator: false }
			this.members.push(member)
			this.emit({ type: 'member', isNew: true, member })
		}
		return this.later(pk)
	}

	joinGroup(_link: string) {
		return this.createGroup('Grupo convidado', []).then(() => undefined)
	}

	groupLink(publicKey: string) {
		return this.later(`IPARROT://PB/DEMO-GROUP-${publicKey.toUpperCase()}-CODIGO-ILUSTRATIVO`)
	}

	muteConversation(publicKey: string, muted: boolean) {
		const c = this.conversations.find(x => x.publicKey === publicKey)
		if (c) {
			c.mutedUntil = muted ? Date.now() + 100 * 365 * 24 * 3600_000 : 0
			this.emit({ type: 'conversation', isNew: false, conversation: { ...c } })
		}
		return this.later(undefined)
	}

	hideConversation(publicKey: string, hidden: boolean) {
		if (!hidden) return this.later(undefined)
		this.conversations = this.conversations.filter(c => c.publicKey !== publicKey)
		this.emit({ type: 'conversationDeleted', isNew: true, publicKey })
		return this.later(undefined)
	}

	leaveGroup(publicKey: string) {
		return this.hideConversation(publicKey, true)
	}

	blockContact(publicKey: string, conversationPublicKey: string, blocked: boolean) {
		if (!blocked) {
			this.blocked = this.blocked.filter(pk => pk !== publicKey)
			return this.later(undefined)
		}
		this.blocked.push(publicKey)
		this.contacts = this.contacts.filter(c => c.publicKey !== publicKey)
		if (conversationPublicKey) return this.hideConversation(conversationPublicKey, true)
		return this.later(undefined)
	}

	blockedContacts() {
		return this.later([...this.blocked])
	}

	openConversation(publicKey: string) {
		const c = this.conversations.find(x => x.publicKey === publicKey)
		if (c) {
			c.isOpen = true
			c.unreadCount = 0
			this.emit({ type: 'conversation', isNew: false, conversation: { ...c } })
		}
		return Promise.resolve()
	}

	closeConversation(publicKey: string) {
		const c = this.conversations.find(x => x.publicKey === publicKey)
		if (c) c.isOpen = false
		return Promise.resolve()
	}

	loadOlder(publicKey: string) {
		setTimeout(() => this.emit({ type: 'history', isNew: false, publicKey, interactions: [] }), 200)
		return Promise.resolve()
	}

	sendMessage(conversation: string, text: string) {
		const mine: Interaction = {
			cid: `demo-${++this.seq}`, type: 'TypeUserMessage', conversationPublicKey: conversation,
			memberPublicKey: 'me', isMine: true, acknowledged: false, sentDate: Date.now(), text,
		}
		this.interactions.push(mine)
		this.touch(conversation, mine.sentDate)
		this.emit({ type: 'interaction', isNew: true, interaction: { ...mine } })
		this.bump(conversation)

		setTimeout(() => {
			mine.acknowledged = true
			this.emit({ type: 'interaction', isNew: false, interaction: { ...mine } })
		}, 600)

		if (conversation === 'conv-louro') {
			setTimeout(() => {
				const echo: Interaction = {
					cid: `demo-${++this.seq}`, type: 'TypeUserMessage', conversationPublicKey: conversation,
					memberPublicKey: 'louro', isMine: false, acknowledged: false, sentDate: Date.now(), text,
				}
				this.interactions.push(echo)
				this.touch(conversation, echo.sentDate)
				this.emit({ type: 'interaction', isNew: true, interaction: echo })
				this.bump(conversation)
			}, 1300)
		}
		return this.later(mine.cid, 60)
	}

	private bump(conversation: string) {
		const c = this.conversations.find(x => x.publicKey === conversation)
		if (c) this.emit({ type: 'conversation', isNew: false, conversation: { ...c } })
	}

	search(query: string) {
		const q = query.toLowerCase()
		return this.later(this.interactions.filter(i => i.text?.toLowerCase().includes(q)).map(i => ({ ...i })))
	}

	servers(): Promise<ServersState> {
		const usingDefaults = this.demoServers.rdvp.length === 0 || this.demoServers.relays.length === 0
		return this.later({
			...this.demoServers,
			// No modo demonstração não há nó de verdade; o espelho do que o
			// weshnet faria basta para a tela mostrar o mesmo aviso.
			effectiveRdvp: this.demoServers.rdvp.length ? [...this.demoServers.rdvp] : [DEMO_DEFAULT_RDVP],
			effectiveRelays: this.demoServers.relays.length ? [...this.demoServers.relays] : [DEMO_DEFAULT_RELAY],
			usingDefaults,
		})
	}

	setServers(servers: Servers) {
		this.demoServers = { rdvp: [...servers.rdvp], relays: [...servers.relays] }
		return this.later(undefined)
	}

	exportAccount(): Promise<ExportResult> {
		return Promise.reject(new Error('O backup só existe com o núcleo do IParrot em execução.'))
	}

	network(): Promise<NetworkInfo> {
		return this.later({
			peerId: '12D3KooWDemoPeerIdApenasIlustrativo',
			listeners: ['/ip4/192.168.0.14/udp/52114/quic-v1'],
			connectedPeers: 3,
			peers: [
				{ id: '12D3KooWHhDB…HzcZ', active: true, latencyMs: 48, features: ['WeshFeature', 'QuicFeature'], routeCount: 1 },
				{ id: '12D3KooWAHcE…Cmjr', active: true, latencyMs: 52, features: ['QuicFeature'], routeCount: 1 },
				{ id: '12D3KooWQ7ma…u1Pd', active: true, latencyMs: 4, features: ['WeshFeature', 'LocalFeature'], routeCount: 2 },
			],
			goVersion: '—',
			os: 'navegador',
			arch: '—',
		})
	}
}
