import { Ban, ChevronRight, Download, ExternalLink, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { Panel } from '../components/Panel'
import { ParrotMark } from '../components/ParrotMark'
import type { NetworkInfo } from '../core/types'
import { inspirations, loadLicenseText, type Inspiration } from '../inspirations'
import { LANGUAGES, setLanguage, useLanguage, useT } from '../i18n'
import { useStore, type SettingsPage, type Theme } from '../store'

type Page = SettingsPage

export function SettingsPanel({ page }: { page: Page }) {
	const open = useStore(s => s.open)
	const close = () => open(null)
	const go = (p: Page) => open({ name: 'settings', page: p })

	switch (page) {
		case 'network':
			return <Network onClose={close} onBack={() => go('home')} onServers={() => go('servers')} />
		case 'servers':
			return <ServersPage onClose={close} onBack={() => go('network')} />
		case 'blocked':
			return <Blocked onClose={close} onBack={() => go('home')} />
		case 'backup':
			return <Backup onClose={close} onBack={() => go('home')} />
		case 'about':
			return <About onClose={close} onBack={() => go('home')} onInspirations={() => go('inspirations')} />
		case 'inspirations':
			return <Inspirations onClose={close} onBack={() => go('about')} />
		default:
			return <Home onClose={close} go={go} />
	}
}

function NavRow({ title, detail, onClick }: { title: string; detail: string; onClick(): void }) {
	return (
		<button className="row" onClick={onClick}>
			<div className="body">
				<div className="name">{title}</div>
				<div className="preview">{detail}</div>
			</div>
			<ChevronRight size={20} aria-hidden />
		</button>
	)
}

function Home({ onClose, go }: { onClose(): void; go(p: Page): void }) {
	const core = useStore(s => s.core)
	const account = useStore(s => s.account)
	const theme = useStore(s => s.theme)
	const setTheme = useStore(s => s.setTheme)
	const notify = useStore(s => s.notify)
	const t = useT()
	const language = useLanguage()
	const [name, setName] = useState(account?.displayName ?? '')
	const [busy, setBusy] = useState(false)

	const changed = name.trim() !== '' && name.trim() !== account?.displayName

	const save = async (e: FormEvent) => {
		e.preventDefault()
		if (!core || !changed) return
		setBusy(true)
		try {
			const updated = await core.updateAccount(name.trim())
			useStore.setState({ account: updated })
			notify(t('settings.nameSaved'))
		} catch (err) {
			notify(err instanceof Error ? err.message : t('settings.nameFailed'))
		} finally {
			setBusy(false)
		}
	}

	const themes: { id: Theme; label: string; icon: typeof Sun }[] = [
		{ id: 'system', label: t('settings.themeSystem'), icon: Monitor },
		{ id: 'light', label: t('settings.themeLight'), icon: Sun },
		{ id: 'dark', label: t('settings.themeDark'), icon: Moon },
	]

	return (
		<Panel title={t('settings.title')} onClose={onClose}>
			<form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
					<Avatar name={name || account?.displayName || '?'} id={account?.publicKey ?? 'eu'} size="l" />
					<label className="field" style={{ flex: 1 }}>
						<span>{t('settings.yourName')}</span>
						<input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={64} />
					</label>
				</div>
				{changed && (
					<button className="btn" disabled={busy}>
						{busy ? t('settings.savingName') : t('settings.saveName')}
					</button>
				)}
			</form>

			<div>
				<div className="section-title" style={{ paddingInline: 0 }}>
					{t('settings.appearance')}
				</div>
				<div className="seg">
					{themes.map(t => (
						<button key={t.id} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
							<t.icon size={17} aria-hidden /> {t.label}
						</button>
					))}
				</div>
			</div>

			<div>
				<div className="section-title" style={{ paddingInline: 0 }}>
					{t('settings.language')}
				</div>
				<div className="seg">
					{LANGUAGES.map(l => (
						<button key={l.id} aria-pressed={language === l.id} onClick={() => setLanguage(l.id)}>
							{l.label}
						</button>
					))}
				</div>
			</div>

			<div style={{ marginInline: -12 }}>
				<NavRow title={t('settings.blocked')} detail={t('settings.blockedDetail')} onClick={() => go('blocked')} />
				<NavRow title={t('settings.network')} detail={t('settings.networkDetail')} onClick={() => go('network')} />
				<NavRow title={t('settings.backup')} detail={t('settings.backupDetail')} onClick={() => go('backup')} />
				<NavRow title={t('settings.about')} detail={t('settings.aboutDetail')} onClick={() => go('about')} />
			</div>
		</Panel>
	)
}

function ServersPage({ onClose, onBack }: { onClose(): void; onBack(): void }) {
	const core = useStore(s => s.core)
	const notify = useStore(s => s.notify)
	const t = useT()
	const [rdvp, setRdvp] = useState('')
	const [relays, setRelays] = useState('')
	const [loaded, setLoaded] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [saved, setSaved] = useState(false)

	useEffect(() => {
		if (!core) return
		let cancelled = false
		core
			.servers()
			.then(s => {
				if (cancelled) return
				setRdvp(s.rdvp.join('\n'))
				setRelays(s.relays.join('\n'))
				setLoaded(true)
			})
			.catch(err => !cancelled && setError(err instanceof Error ? err.message : t('servers.readFailed')))
		return () => {
			cancelled = true
		}
	}, [core])

	const lines = (v: string) =>
		v
			.split('\n')
			.map(x => x.trim())
			.filter(Boolean)

	const save = async (e: FormEvent) => {
		e.preventDefault()
		if (!core) return
		setBusy(true)
		setError('')
		try {
			await core.setServers({ rdvp: lines(rdvp), relays: lines(relays) })
			setSaved(true)
			notify(t('servers.savedToast'))
		} catch (err) {
			setError(err instanceof Error ? err.message : t('servers.saveFailed'))
		} finally {
			setBusy(false)
		}
	}

	return (
		<Panel title={t('servers.title')} onClose={onClose} onBack={onBack}>
			<p className="hint">{t('servers.lede')}</p>
			<p className="hint">{t('servers.lede2')}</p>
			<form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
				<label className="field">
					<span>{t('servers.rdvpLabel')}</span>
					<textarea
						className="input"
						value={rdvp}
						onChange={e => {
							setRdvp(e.target.value)
							setSaved(false)
						}}
						placeholder={'/ip4/203.0.113.10/tcp/4040/p2p/12D3KooW…'}
						spellCheck={false}
						disabled={!loaded}
					/>
				</label>
				<label className="field">
					<span>{t('servers.relaysLabel')}</span>
					<textarea
						className="input"
						value={relays}
						onChange={e => {
							setRelays(e.target.value)
							setSaved(false)
						}}
						placeholder={'/ip4/203.0.113.11/udp/4001/quic-v1/p2p/12D3KooW…'}
						spellCheck={false}
						disabled={!loaded}
					/>
				</label>
				{error && <p className="error-text">{error}</p>}
				{saved && <p className="hint">{t('servers.saved')}</p>}
				<button className="btn" disabled={busy || !loaded}>
					{busy ? t('servers.saving') : t('servers.save')}
				</button>
			</form>
		</Panel>
	)
}

function Backup({ onClose, onBack }: { onClose(): void; onBack(): void }) {
	const core = useStore(s => s.core)
	const t = useT()
	const [busy, setBusy] = useState(false)
	const [path, setPath] = useState('')
	const [size, setSize] = useState(0)
	const [error, setError] = useState('')

	const run = async () => {
		if (!core) return
		setBusy(true)
		setError('')
		setPath('')
		try {
			const result = await core.exportAccount()
			setPath(result.path)
			setSize(result.bytes)
		} catch (err) {
			setError(err instanceof Error ? err.message : t('backup.failed'))
		} finally {
			setBusy(false)
		}
	}

	return (
		<Panel title={t('backup.title')} onClose={onClose} onBack={onBack}>
			<p>{t('backup.body')}</p>
			<p className="hint">
				<strong>{t('backup.warningLead')}</strong> {t('backup.warning')}
			</p>
			{error && <p className="error-text">{error}</p>}
			{path && (
				<div>
					<p className="hint">{t('backup.savedAt')}</p>
					<div className="code">{path}</div>
					<p className="hint">{(size / 1024 / 1024).toFixed(1)} MB</p>
				</div>
			)}
			<button className="btn wide" onClick={() => void run()} disabled={busy}>
				<Download size={18} aria-hidden />
				{busy ? t('backup.running') : path ? t('backup.runAgain') : t('backup.run')}
			</button>
			<p className="hint">{t('backup.restoreNote')}</p>
		</Panel>
	)
}

function Blocked({ onClose, onBack }: { onClose(): void; onBack(): void }) {
	const core = useStore(s => s.core)
	const resync = useStore(s => s.resync)
	const notify = useStore(s => s.notify)
	const t = useT()
	const [list, setList] = useState<string[] | null>(null)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState('')

	useEffect(() => {
		if (!core) return
		let cancelled = false
		core
			.blockedContacts()
			.then(b => !cancelled && setList(b))
			.catch(err => !cancelled && setError(err instanceof Error ? err.message : t('blocked.readFailed')))
		return () => {
			cancelled = true
		}
	}, [core])

	const unblock = async (pk: string) => {
		if (!core) return
		setBusy(pk)
		try {
			await core.blockContact(pk, '', false)
			setList(l => (l ?? []).filter(x => x !== pk))
			resync()
			notify(t('blocked.unblocked'))
		} catch (err) {
			notify(err instanceof Error ? err.message : t('blocked.unblockFailed'))
		} finally {
			setBusy('')
		}
	}

	return (
		<Panel title={t('blocked.title')} onClose={onClose} onBack={onBack}>
			<p className="hint">{t('blocked.lede')}</p>
			{error && <p className="error-text">{error}</p>}
			{list?.length === 0 && (
				<div className="empty-note">
					<strong>{t('blocked.emptyTitle')}</strong>
					{t('blocked.emptyBody')}
				</div>
			)}
			{list?.map(pk => (
				<div className="row" key={pk} style={{ paddingInline: 0 }}>
					<Ban size={20} aria-hidden />
					<div className="body">
						<div className="name" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
							{pk}
						</div>
						<div className="preview">{t('blocked.publicKey')}</div>
					</div>
					<button className="btn quiet small" disabled={busy === pk} onClick={() => void unblock(pk)}>
						{busy === pk ? t('common.wait') : t('blocked.unblock')}
					</button>
				</div>
			))}
			{!list && !error && <p className="hint">{t('common.loading')}</p>}
		</Panel>
	)
}

function Network({ onClose, onBack, onServers }: { onClose(): void; onBack(): void; onServers(): void }) {
	const core = useStore(s => s.core)
	const t = useT()
	const [info, setInfo] = useState<NetworkInfo | null>(null)
	const [error, setError] = useState('')

	useEffect(() => {
		if (!core) return
		let cancelled = false
		const load = () =>
			core
				.network()
				.then(n => !cancelled && (setInfo(n), setError('')))
				.catch(err => !cancelled && setError(err instanceof Error ? err.message : t('network.failed')))
		void load()
		const timer = setInterval(load, 5000)
		return () => {
			cancelled = true
			clearInterval(timer)
		}
	}, [core])

	return (
		<Panel title={t('network.title')} onClose={onClose} onBack={onBack}>
			<p className="hint">{t('network.lede')}</p>
			{error && <p className="error-text">{error}</p>}
			{!info && !error && <p className="hint">{t('network.reading')}</p>}
			<button className="btn quiet wide" onClick={onServers}>
				{t('network.ownServers')}
			</button>
			{info && (
				<>
					<dl className="kv">
						<dt>{t('network.connected')}</dt>
						<dd>
							<strong>{info.connectedPeers}</strong>
						</dd>
						<dt>{t('network.peerId')}</dt>
						<dd className="code">{info.peerId}</dd>
						<dt>{t('network.listeners')}</dt>
						<dd>
							{info.listeners.length === 0 && t('network.noListeners')}
							{info.listeners.map(l => (
								<div className="code" key={l} style={{ marginBottom: 6 }}>
									{l}
								</div>
							))}
						</dd>
					</dl>
					{info.peers.length > 0 && (
						<div>
							<div className="section-title" style={{ paddingInline: 0 }}>
								{t('network.connections')}
							</div>
							{info.peers.map(p => (
								<div className="row" key={p.id} style={{ paddingInline: 0 }}>
									<div className="body">
										<div className="name" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
											{p.id}
										</div>
										<div className="preview">
											{p.features.map(f => f.replace('Feature', '')).join(', ') || 'libp2p'}
											{p.latencyMs > 0 ? `, ${p.latencyMs} ms` : ''}
										</div>
									</div>
									<span className={`tag${p.active ? '' : ' study'}`}>
										{p.active ? t('network.active') : t('network.inactive')}
									</span>
								</div>
							))}
						</div>
					)}
				</>
			)}
		</Panel>
	)
}

function About({ onClose, onBack, onInspirations }: { onClose(): void; onBack(): void; onInspirations(): void }) {
	const core = useStore(s => s.core)
	const t = useT()
	return (
		<Panel title={t('about.title')} onClose={onClose} onBack={onBack}>
			<div className="center" style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
				<ParrotMark className="about-mark" title={t('app.name')} />
				<h3 style={{ fontSize: '1.5rem' }}>{t('app.name')}</h3>
				<p className="hint">
					{t('about.version', { version: core?.version ?? '—' })}
					{core?.mode === 'demo' ? t('about.demoSuffix') : ''}
				</p>
			</div>
			<p className="credito">
				{t('about.developedBy')}{' '}
				<a className="aordic" href="https://aordic.com.br" target="_blank" rel="noreferrer noopener">
					AORDIC
				</a>
			</p>
			<p>{t('about.body')}</p>
			<p className="hint">{t('about.license')}</p>
			{/* Este botão não pode sair daqui. O IParrot é proprietário, mas
			    depende de Berty e weshnet (Apache-2.0 ou MIT) e embarca uma
			    cópia do driver GORM/SQLCipher (MIT). As três exigem que o aviso
			    de direitos autorais e o texto da licença acompanhem toda
			    distribuição, e num APK não vai arquivo nenhum junto: esta tela é
			    o único caminho até o usuário. Ver NOTICE.md e
			    scripts/conferir-licencas.py. */}
			<button className="btn quiet wide" onClick={onInspirations}>
				{t('about.licenses')}
			</button>
		</Panel>
	)
}

function Inspirations({ onClose, onBack }: { onClose(): void; onBack(): void }) {
	const t = useT()
	const [current, setCurrent] = useState<Inspiration | null>(null)

	if (current) return <InspirationDetail item={current} onClose={onClose} onBack={() => setCurrent(null)} />

	const used = inspirations.filter(i => i.bundled)
	const studied = inspirations.filter(i => !i.bundled)

	const card = (i: Inspiration) => (
		<button className="insp" key={i.id} onClick={() => setCurrent(i)}>
			<span className="top">
				<strong>{i.name}</strong>
				<span className={`tag${i.bundled ? '' : ' study'}`}>
					{i.bundled ? t('inspirations.bundledTag') : t('inspirations.studiedTag')}
				</span>
			</span>
			<span>{i.about}</span>
			<span className="lic">{t('inspirations.licenseLabel', { license: i.license })}</span>
		</button>
	)

	return (
		<Panel title={t('inspirations.title')} onClose={onClose} onBack={onBack} wide>
			<p className="hint">{t('inspirations.lede')}</p>
			<div className="section-title" style={{ padding: 0 }}>
				{t('inspirations.bundledTitle')}
			</div>
			{used.map(card)}
			<div className="section-title" style={{ padding: 0 }}>
				{t('inspirations.studiedTitle')}
			</div>
			{studied.map(card)}
		</Panel>
	)
}

function InspirationDetail({ item, onClose, onBack }: { item: Inspiration; onClose(): void; onBack(): void }) {
	const t = useT()
	const [doc, setDoc] = useState(item.docs[0])
	const [text, setText] = useState('')
	const [error, setError] = useState('')

	useEffect(() => {
		if (!doc) return
		let cancelled = false
		setText('')
		setError('')
		loadLicenseText(doc.file)
			.then(t => !cancelled && setText(t))
			.catch(() => !cancelled && setError(t('inspirations.textFailed')))
		return () => {
			cancelled = true
		}
	}, [doc])

	return (
		<Panel title={item.name} onClose={onClose} onBack={onBack} wide>
			<dl className="kv">
				<dt>{t('inspirations.what')}</dt>
				<dd>{item.about}</dd>
				<dt>{t('inspirations.role')}</dt>
				<dd>{item.role}</dd>
				<dt>{t('inspirations.license')}</dt>
				<dd>{item.license}</dd>
				<dt>{t('inspirations.holder')}</dt>
				<dd>{item.holder}</dd>
				<dt>{t('inspirations.repo')}</dt>
				<dd>
					<a href={item.repo} target="_blank" rel="noreferrer noopener">
						{item.repo.replace('https://', '')} <ExternalLink size={13} aria-hidden />
					</a>
				</dd>
			</dl>

			{item.docs.length > 1 && (
				<div className="tabs" role="tablist" aria-label={t('inspirations.docsLabel')}>
					{item.docs.map(d => (
						<button key={d.file} role="tab" aria-selected={d.file === doc?.file} onClick={() => setDoc(d)}>
							{d.label}
						</button>
					))}
				</div>
			)}
			{error && <p className="error-text">{error}</p>}
			<pre className="license-text" tabIndex={0} aria-label={doc?.label}>
				{text || (error ? '' : t('common.loading'))}
			</pre>
		</Panel>
	)
}
