import { Plus, QrCode, Search, Settings, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { ParrotMark } from '../components/ParrotMark'
import type { Contact } from '../core/types'
import { listStamp } from '../lib/format'
import { useT } from '../i18n'
import { conversationName, useStore } from '../store'

export function Sidebar() {
	const core = useStore(s => s.core)
	const online = useStore(s => s.online)
	const loaded = useStore(s => s.loaded)
	const contacts = useStore(s => s.contacts)
	const conversations = useStore(s => s.conversations)
	const messages = useStore(s => s.messages)
	const active = useStore(s => s.active)
	const select = useStore(s => s.select)
	const open = useStore(s => s.open)
	const notify = useStore(s => s.notify)
	const t = useT()

	const [query, setQuery] = useState('')
	const [menu, setMenu] = useState(false)
	const [accepting, setAccepting] = useState<string | null>(null)

	const q = query.trim().toLowerCase()

	const list = useMemo(() => {
		return Object.values(conversations)
			.filter(c => c.type === 'ContactType' || c.type === 'MultiMemberType')
			.map(c => {
				const thread = messages[c.publicKey] ?? []
				const last = thread[thread.length - 1]
				return { c, name: conversationName(c, contacts), last, when: Math.max(c.lastUpdate, last?.sentDate ?? 0) }
			})
			.filter(x => !q || x.name.toLowerCase().includes(q) || (messages[x.c.publicKey] ?? []).some(m => m.text?.toLowerCase().includes(q)))
			.sort((a, b) => b.when - a.when)
	}, [conversations, contacts, messages, q])

	const incoming = Object.values(contacts).filter(c => c.state === 'IncomingRequest')
	const outgoing = Object.values(contacts).filter(c => c.state === 'OutgoingRequestSent' || c.state === 'OutgoingRequestEnqueued')

	const accept = async (contact: Contact) => {
		if (!core) return
		setAccepting(contact.publicKey)
		try {
			await core.acceptContact(contact.publicKey)
			notify(t('sidebar.accepted', { name: contact.displayName || t('sidebar.contact') }))
		} catch (err) {
			notify(err instanceof Error ? err.message : t('sidebar.acceptFailed'))
		} finally {
			setAccepting(null)
		}
	}

	const preview = (text: string | undefined, mine: boolean, invitation: boolean) => {
		if (invitation) return t('sidebar.previewInvitation')
		if (!text) return t('sidebar.previewEmpty')
		return mine ? t('sidebar.previewYou', { text }) : text
	}

	return (
		<aside className="sidebar on-brand">
			<div className="side-head">
				<span className="wordmark">
					<ParrotMark /> {t('app.name')}
				</span>
				<button className="icon-btn" onClick={() => open({ name: 'share' })} aria-label={t('sidebar.myCode')}>
					<QrCode size={22} />
				</button>
				<button className="icon-btn" onClick={() => open({ name: 'settings', page: 'home' })} aria-label={t('sidebar.settings')}>
					<Settings size={22} />
				</button>
			</div>

			<label className="search">
				<Search size={18} aria-hidden />
				<span className="sr-only">{t('sidebar.searchLabel')}</span>
				<input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('sidebar.searchLabel')} />
			</label>

			{core?.mode === 'demo' && (
				<p className="banner">{t('sidebar.demoBanner')}</p>
			)}
			{core?.mode === 'p2p' && !online && <p className="banner">{t('sidebar.reconnecting')}</p>}

			<div className="side-body">
				{incoming.length > 0 && (
					<>
						<h3 className="section-title">{t('sidebar.requests')}</h3>
						{incoming.map(c => (
							<div className="row" key={c.publicKey}>
								<Avatar name={c.displayName} id={c.publicKey} />
								<div className="body">
									<div className="name">{c.displayName || t('sidebar.someone')}</div>
									<div className="preview">{t('sidebar.wantsToTalk')}</div>
								</div>
								<button className="btn small" disabled={accepting === c.publicKey} onClick={() => accept(c)}>
									{accepting === c.publicKey ? t('sidebar.accepting') : t('sidebar.accept')}
								</button>
							</div>
						))}
					</>
				)}

				{(incoming.length > 0 || outgoing.length > 0) && list.length > 0 && (
					<h3 className="section-title">{t('sidebar.conversations')}</h3>
				)}

				{list.map(({ c, name, last, when }) => (
					<button
						key={c.publicKey}
						className={`row${active === c.publicKey ? ' current' : ''}`}
						onClick={() => select(c.publicKey)}
						aria-current={active === c.publicKey ? 'true' : undefined}
					>
						<Avatar name={name} id={c.contactPublicKey || c.publicKey} group={c.type === 'MultiMemberType'} />
						<div className="body">
							<div className="name">{name}</div>
							<div className="preview">{preview(last?.text, !!last?.isMine, last?.type === 'TypeGroupInvitation')}</div>
						</div>
						<div className="side">
							<span className="stamp">{listStamp(when)}</span>
							{c.unreadCount > 0 && active !== c.publicKey && (
								<span className="badge" aria-label={t('sidebar.unread', { count: c.unreadCount })}>
									{c.unreadCount > 99 ? '99+' : c.unreadCount}
								</span>
							)}
						</div>
					</button>
				))}

				{outgoing.length > 0 && (
					<>
						<h3 className="section-title">{t('sidebar.waiting')}</h3>
						{outgoing.map(c => (
							<div className="row" key={c.publicKey}>
								<Avatar name={c.displayName} id={c.publicKey} />
								<div className="body">
									<div className="name">{c.displayName || t('sidebar.contact')}</div>
									<div className="preview">{t('sidebar.waitingDetail')}</div>
								</div>
								{/* O tempo de espera não é enfeite. Um pedido enviado fica
								    procurando o outro aparelho em laço, e quando não acha
								    nunca — servidor de encontro fora do ar, outro lado
								    desligado — o weshnet não devolve erro nenhum: ele
								    continua procurando em silêncio. Sem mostrar há quanto
								    tempo, "não aconteceu nada" e "está procurando há duas
								    horas" ficam idênticos na tela. */}
								<div className="side">
									<span className="stamp">{listStamp(c.sentDate || c.createdDate)}</span>
								</div>
							</div>
						))}
					</>
				)}

				{loaded && list.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
					<div className="empty-note">
						{q ? (
							<>
								<strong>{t('sidebar.noResultsTitle')}</strong>
								{t('sidebar.noResultsBody', { query: query.trim() })}
							</>
						) : (
							<>
								<strong>{t('sidebar.emptyTitle')}</strong>
								{t('sidebar.emptyBody')}
							</>
						)}
					</div>
				)}
				{!loaded && <div className="empty-note">{t('sidebar.loadingConversations')}</div>}
			</div>

			<div className="fab-wrap">
				{menu && (
					<div className="fab-menu">
						<button
							onClick={() => {
								setMenu(false)
								open({ name: 'add' })
							}}
						>
							<UserPlus size={19} /> {t('sidebar.addContact')}
						</button>
						<button
							onClick={() => {
								setMenu(false)
								open({ name: 'newGroup' })
							}}
						>
							<Users size={19} /> {t('sidebar.newGroup')}
						</button>
					</div>
				)}
				<button className="fab" aria-expanded={menu} aria-label={t('sidebar.newConversation')} onClick={() => setMenu(m => !m)}>
					<Plus size={28} />
				</button>
			</div>
		</aside>
	)
}
