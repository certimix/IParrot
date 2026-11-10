import { Check, Copy, Keyboard, QrCode, RefreshCw, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { Panel } from '../components/Panel'
import { Qr } from '../components/Qr'
import { useT } from '../i18n'
import { QrScanner } from '../components/QrScanner'
import type { ParsedLink } from '../core/types'
import { copyText } from '../lib/format'
import { useStore } from '../store'

function useClose() {
	const open = useStore(s => s.open)
	return () => open(null)
}

function CopyButton({ text, label }: { text: string; label: string }) {
	const notify = useStore(s => s.notify)
	const t = useT()
	const [done, setDone] = useState(false)
	return (
		<button
			className="btn quiet"
			onClick={async () => {
				if (await copyText(text)) {
					setDone(true)
					setTimeout(() => setDone(false), 1800)
				} else {
					notify(t('common.copyFailed'))
				}
			}}
		>
			{done ? <Check size={18} /> : <Copy size={18} />} {done ? t('common.copied') : label}
		</button>
	)
}

/** Meu código: o QR e o link que outra pessoa usa para me adicionar. */
export function SharePanel() {
	const close = useClose()
	const core = useStore(s => s.core)
	const t = useT()
	const [link, setLink] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)

	const load = async (reset: boolean) => {
		if (!core) return
		setBusy(true)
		setError('')
		try {
			setLink((await core.share(reset)).link)
		} catch (err) {
			setError(err instanceof Error ? err.message : t('share.failed'))
		} finally {
			setBusy(false)
		}
	}

	useEffect(() => {
		void load(false)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [core])

	return (
		<Panel title={t('share.title')} onClose={close}>
			<p className="hint center">{t('share.lede')}</p>
			{link && (
				<div className="qr-card">
					<Qr value={link} label={t('share.qrLabel')} />
				</div>
			)}
			{!link && !error && <p className="center hint">{t('share.generating')}</p>}
			{error && <p className="error-text center">{error}</p>}
			{link && (
				<>
					<div className="code">{link}</div>
					<div className="actions">
						<CopyButton text={link} label={t('share.copyLink')} />
						<button className="btn quiet" disabled={busy} onClick={() => void load(true)}>
							<RefreshCw size={18} /> {t('share.renew')}
						</button>
					</div>
					<p className="hint">{t('share.renewHint')}</p>
				</>
			)}
		</Panel>
	)
}

/** Adicionar contato ou entrar em grupo colando um link. */
export function AddPanel() {
	const close = useClose()
	const core = useStore(s => s.core)
	const notify = useStore(s => s.notify)
	const t = useT()
	const [link, setLink] = useState('')
	const [parsed, setParsed] = useState<ParsedLink | null>(null)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [mode, setMode] = useState<'scan' | 'paste'>('scan')

	// Confere o link enquanto a pessoa cola, para mostrar de quem é antes de enviar.
	useEffect(() => {
		const value = link.trim()
		setParsed(null)
		setError('')
		if (!value || !core) return
		let cancelled = false
		const timer = setTimeout(() => {
			core
				.parseLink(value)
				.then(p => {
					if (cancelled) return
					if (p.kind === 'unknown') setError(t('add.unknownLink'))
					else setParsed(p)
				})
				.catch(() => !cancelled && setError(t('add.parseFailed')))
		}, 300)
		return () => {
			cancelled = true
			clearTimeout(timer)
		}
		// `t` sai de fora: trocar de idioma não deve refazer a checagem do link.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [link, core])

	const submit = async (e: FormEvent) => {
		e.preventDefault()
		if (!core || !parsed) return
		setBusy(true)
		try {
			if (parsed.kind === 'group') {
				await core.joinGroup(link.trim())
				notify(t('chat.joined'))
			} else {
				await core.requestContact(link.trim())
				notify(t('add.sent'))
			}
			close()
		} catch (err) {
			setError(err instanceof Error ? err.message : t('add.failed'))
		} finally {
			setBusy(false)
		}
	}

	return (
		<Panel title={t('add.title')} onClose={close}>
			<div className="seg">
				<button type="button" aria-pressed={mode === 'scan'} onClick={() => setMode('scan')}>
					<QrCode size={17} aria-hidden /> {t('add.tabScan')}
				</button>
				<button type="button" aria-pressed={mode === 'paste'} onClick={() => setMode('paste')}>
					<Keyboard size={17} aria-hidden /> {t('add.tabPaste')}
				</button>
			</div>

			{mode === 'scan' && (
				<QrScanner
					hint={t('add.scanHint')}
					onRead={text => {
						setLink(text)
						setMode('paste')
					}}
				/>
			)}

			{mode === 'paste' && (
			<form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
				<label className="field">
					<span>{t('add.linkLabel')}</span>
					<textarea
						className="input"
						value={link}
						onChange={e => setLink(e.target.value)}
						placeholder={t('add.linkPlaceholder')}
						spellCheck={false}
					/>
				</label>
				<p className="hint">{t('add.linkHint')}</p>
				{parsed && (
					<div className="row" style={{ background: 'var(--bg-soft)' }}>
						<Avatar name={parsed.displayName || '?'} id={link.trim()} group={parsed.kind === 'group'} />
						<div className="body">
							<div className="name">
								{parsed.displayName || (parsed.kind === 'group' ? t('add.unnamedGroup') : t('add.unnamedContact'))}
							</div>
							<div className="preview">{parsed.kind === 'group' ? t('add.groupLabel') : t('add.contactLabel')}</div>
						</div>
					</div>
				)}
				{error && <p className="error-text">{error}</p>}
				<button className="btn" disabled={!parsed || busy}>
					<UserPlus size={18} />
					{busy ? t('add.submitting') : parsed?.kind === 'group' ? t('add.submitGroup') : t('add.submitContact')}
				</button>
			</form>
			)}
		</Panel>
	)
}

export function NewGroupPanel() {
	const close = useClose()
	const core = useStore(s => s.core)
	const contacts = useStore(s => s.contacts)
	const select = useStore(s => s.select)
	const t = useT()
	const [name, setName] = useState('')
	const [picked, setPicked] = useState<Record<string, boolean>>({})
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	const accepted = Object.values(contacts)
		.filter(c => c.state === 'Accepted')
		.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'))

	const submit = async (e: FormEvent) => {
		e.preventDefault()
		if (!core || !name.trim()) return
		setBusy(true)
		setError('')
		try {
			const pk = await core.createGroup(
				name.trim(),
				Object.keys(picked).filter(k => picked[k]),
			)
			close()
			select(pk)
		} catch (err) {
			setError(err instanceof Error ? err.message : t('group.createFailed'))
		} finally {
			setBusy(false)
		}
	}

	return (
		<Panel title={t('group.title')} onClose={close}>
			<form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
				<label className="field">
					<span>{t('group.nameLabel')}</span>
					<input
						className="input"
						value={name}
						onChange={e => setName(e.target.value)}
						placeholder={t('group.namePlaceholder')}
						maxLength={64}
						autoFocus
					/>
				</label>

				<div>
					<div className="section-title" style={{ paddingInline: 0 }}>
						{t('group.inviteWho')}
					</div>
					{accepted.length === 0 && <p className="hint">{t('group.noContacts')}</p>}
					{accepted.map(c => (
						<label className="row check-row" key={c.publicKey}>
							<Avatar name={c.displayName} id={c.publicKey} size="s" />
							<span className="body name">{c.displayName || t('sidebar.contact')}</span>
							<input type="checkbox" checked={!!picked[c.publicKey]} onChange={e => setPicked(p => ({ ...p, [c.publicKey]: e.target.checked }))} />
						</label>
					))}
				</div>

				{error && <p className="error-text">{error}</p>}
				<button className="btn" disabled={busy || !name.trim()}>
					{busy ? t('group.creating') : t('group.create')}
				</button>
			</form>
		</Panel>
	)
}

export function GroupInfoPanel({ publicKey }: { publicKey: string }) {
	const close = useClose()
	const core = useStore(s => s.core)
	const conversation = useStore(s => s.conversations[publicKey])
	const members = useStore(s => s.members[publicKey])
	const account = useStore(s => s.account)
	const t = useT()
	const [link, setLink] = useState('')
	const [error, setError] = useState('')

	const name = conversation?.displayName || t('add.unnamedGroup')

	useEffect(() => {
		if (!core) return
		let cancelled = false
		core
			.groupLink(publicKey, name)
			.then(l => !cancelled && setLink(l))
			.catch(err => !cancelled && setError(err instanceof Error ? err.message : t('group.inviteFailed')))
		return () => {
			cancelled = true
		}
	}, [core, publicKey, name])

	const list = Object.values(members ?? {}).sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.displayName.localeCompare(b.displayName, 'pt-BR'))

	return (
		<Panel title={name} onClose={close}>
			<div>
				<div className="section-title" style={{ paddingInline: 0 }}>
					{list.length === 1 ? t('group.membersOne') : t('group.membersCount', { count: list.length })}
				</div>
				{list.map(m => (
					<div className="row" key={m.publicKey} style={{ paddingInline: 0 }}>
						<Avatar name={m.isMe ? account?.displayName || '' : m.displayName} id={m.publicKey} size="s" />
						<span className="body name">
							{m.isMe ? t('group.you', { name: account?.displayName ?? '' }) : m.displayName || t('chat.participant')}
						</span>
						{m.isCreator && <span className="tag">{t('group.creator')}</span>}
					</div>
				))}
			</div>

			<div style={{ display: 'grid', gap: 12 }}>
				<div className="section-title" style={{ padding: 0 }}>
					{t('group.inviteByLink')}
				</div>
				<p className="hint">{t('group.inviteWarning')}</p>
				{link && (
					<>
						<div className="qr-card">
							<Qr value={link} label={t('group.inviteQr', { name })} />
						</div>
						<div className="code">{link}</div>
						<div className="actions">
							<CopyButton text={link} label={t('group.copyInvite')} />
						</div>
					</>
				)}
				{!link && !error && <p className="hint">{t('group.generatingInvite')}</p>}
				{error && <p className="error-text">{error}</p>}
			</div>
		</Panel>
	)
}
