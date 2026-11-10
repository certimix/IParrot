import { ArrowLeft, BellOff, Check, CheckCheck, Lock, MoreVertical, Send, Users } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Avatar } from '../components/Avatar'
import type { Interaction } from '../core/types'
import { clock, dayLabel, sameDay, toneFor } from '../lib/format'
import { useT } from '../i18n'
import { conversationName, useStore } from '../store'

const PAGE = 30
const EMPTY: Interaction[] = []

export function Chat({ publicKey }: { publicKey: string }) {
	const core = useStore(s => s.core)
	const conversation = useStore(s => s.conversations[publicKey])
	const contacts = useStore(s => s.contacts)
	const members = useStore(s => s.members[publicKey])
	const thread = useStore(s => s.messages[publicKey]) ?? EMPTY
	const exhausted = useStore(s => s.exhausted[publicKey])
	const select = useStore(s => s.select)
	const open = useStore(s => s.open)
	const notify = useStore(s => s.notify)
	const t = useT()

	const [draft, setDraft] = useState('')
	const [sending, setSending] = useState(false)
	const [loadingOlder, setLoadingOlder] = useState(false)
	const [joining, setJoining] = useState<string | null>(null)
	const scroller = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLTextAreaElement>(null)
	const pinned = useRef(true)

	const lastCid = thread[thread.length - 1]?.cid

	// Mantém a conversa no fim quando chega mensagem, a menos que a pessoa tenha subido para ler.
	useLayoutEffect(() => {
		const el = scroller.current
		if (el && pinned.current) el.scrollTop = el.scrollHeight
	}, [lastCid, publicKey])

	useEffect(() => {
		pinned.current = true
		setDraft('')
		setLoadingOlder(false)
		input.current?.focus()
	}, [publicKey])

	useEffect(() => {
		setLoadingOlder(false)
	}, [thread.length, exhausted])

	if (!conversation) return null

	const isGroup = conversation.type === 'MultiMemberType'
	const name = conversationName(conversation, contacts)
	const memberCount = members ? Object.keys(members).length : 0
	const muted = conversation.mutedUntil > Date.now()

	const send = async () => {
		const text = draft.trim()
		if (!text || !core || sending) return
		setSending(true)
		pinned.current = true
		try {
			await core.sendMessage(publicKey, text)
			setDraft('')
			if (input.current) input.current.style.height = 'auto'
		} catch (err) {
			notify(err instanceof Error ? err.message : t('chat.sendFailed'))
		} finally {
			setSending(false)
			input.current?.focus()
		}
	}

	const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault()
			void send()
		}
	}

	const loadOlder = async () => {
		const first = thread[0]
		if (!first || !core) return
		setLoadingOlder(true)
		pinned.current = false
		try {
			await core.loadOlder(publicKey, first.cid, PAGE)
		} catch {
			setLoadingOlder(false)
			notify(t('chat.loadOlderFailed'))
		}
	}

	const join = async (m: Interaction) => {
		if (!m.invitationLink || !core) return
		setJoining(m.cid)
		try {
			await core.joinGroup(m.invitationLink)
			notify(t('chat.joined'))
		} catch (err) {
			notify(err instanceof Error ? err.message : t('chat.joinFailed'))
		} finally {
			setJoining(null)
		}
	}

	const authorName = (m: Interaction) =>
		members?.[m.memberPublicKey]?.displayName || contacts[m.memberPublicKey]?.displayName || t('chat.participant')

	return (
		<>
			<header className="chat-head">
				<button className="icon-btn back" onClick={() => select(null)} aria-label={t('chat.backToList')}>
					<ArrowLeft size={22} />
				</button>
				<Avatar name={name} id={conversation.contactPublicKey || publicKey} group={isGroup} />
				{isGroup ? (
					<button className="who" onClick={() => open({ name: 'groupInfo', publicKey })}>
						<div className="name">{name}</div>
						<div className="sub">
							<Users size={13} aria-hidden />
							{memberCount === 1 ? t('chat.membersOne') : t('chat.members', { count: memberCount })}
						</div>
					</button>
				) : (
					<div className="who">
						<div className="name">{name}</div>
						<div className="sub">
							<Lock size={13} aria-hidden /> {t('chat.encrypted')}
						</div>
					</div>
				)}
				{muted && <BellOff size={17} aria-label={t('chat.muted')} />}
				<button className="icon-btn" onClick={() => open({ name: 'conversationActions', publicKey })} aria-label={t('chat.actions')}>
					<MoreVertical size={22} />
				</button>
			</header>

			<div
				className="thread"
				ref={scroller}
				onScroll={e => {
					const el = e.currentTarget
					pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
				}}
			>
				{thread.length >= PAGE && !exhausted && (
					<button className="btn quiet small older" onClick={loadOlder} disabled={loadingOlder}>
						{loadingOlder ? t('chat.loadingOlder') : t('chat.loadOlder')}
					</button>
				)}

				{thread.length === 0 && (
					<div className="empty-note" style={{ margin: 'auto' }}>
						<strong>{isGroup ? t('chat.emptyGroup') : t('chat.emptyContact', { name })}</strong>
						{t('chat.emptyBody')}
					</div>
				)}

				{thread.map((m, i) => {
					const prev = thread[i - 1]
					const next = thread[i + 1]
					const newDay = !prev || !sameDay(prev.sentDate, m.sentDate)
					const sameAuthorAsPrev = !!prev && !newDay && prev.memberPublicKey === m.memberPublicKey && prev.isMine === m.isMine
					const lastOfRun = !next || next.memberPublicKey !== m.memberPublicKey || next.isMine !== m.isMine || !sameDay(next.sentDate, m.sentDate)
					const cls = ['msg', m.isMine ? 'mine' : '', sameAuthorAsPrev ? '' : 'gap', lastOfRun ? 'last' : ''].filter(Boolean).join(' ')

					return (
						<div key={m.cid} style={{ display: 'contents' }}>
							{newDay && <div className="day">{dayLabel(m.sentDate)}</div>}
							<div className={cls}>
								{isGroup && !m.isMine && !sameAuthorAsPrev && (
									<span className="author" style={{ color: toneFor(m.memberPublicKey) }}>
										{authorName(m)}
									</span>
								)}
								{m.type === 'TypeGroupInvitation' ? (
									<div className="invite">
										<strong>
											<Users size={18} aria-hidden /> {t('chat.invitationTitle')}
										</strong>
										{m.isMine ? (
											<span className="hint">{t('chat.invitationMine')}</span>
										) : (
											<button className="btn small" disabled={joining === m.cid} onClick={() => join(m)}>
												{joining === m.cid ? t('chat.joining') : t('chat.join')}
											</button>
										)}
									</div>
								) : (
									<div className="bubble">{m.text}</div>
								)}
								{lastOfRun && (
									<span className="meta">
										{clock(m.sentDate)}
										{m.isMine &&
											(m.acknowledged ? (
												<CheckCheck size={14} aria-label={t('chat.delivered')} />
											) : (
												<Check size={14} aria-label={t('chat.sent')} />
											))}
									</span>
								)}
							</div>
						</div>
					)
				})}
			</div>

			<div className="composer">
				<textarea
					ref={input}
					rows={1}
					value={draft}
					placeholder={t('chat.composer', { name })}
					aria-label={t('chat.composer', { name })}
					onChange={e => {
						setDraft(e.target.value)
						e.target.style.height = 'auto'
						e.target.style.height = `${Math.min(e.target.scrollHeight + 4, 140)}px`
					}}
					onKeyDown={onKeyDown}
				/>
				<button className="send" onClick={() => void send()} disabled={!draft.trim() || sending} aria-label={t('chat.send')}>
					<Send size={20} />
				</button>
			</div>
		</>
	)
}
