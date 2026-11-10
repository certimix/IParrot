import { useState, type FormEvent } from 'react'
import { ParrotMark } from '../components/ParrotMark'
import { useT } from '../i18n'
import { useStore } from '../store'

/** Primeira abertura: a identidade já existe no aparelho, falta só o nome. */
export function Welcome() {
	const core = useStore(s => s.core)
	const t = useT()
	const [name, setName] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	const submit = async (e: FormEvent) => {
		e.preventDefault()
		const clean = name.trim()
		if (!clean || !core) return
		setBusy(true)
		setError('')
		try {
			const account = await core.updateAccount(clean)
			useStore.setState({ account })
		} catch (err) {
			setError(err instanceof Error ? err.message : t('welcome.error'))
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="welcome">
			<section className="welcome-art on-brand">
				<span className="wordmark">
					<ParrotMark /> {t('app.name')}
				</span>
				<ParrotMark className="giant" />
				<h1>{t('welcome.headline')}</h1>
			</section>

			<section className="welcome-form">
				<h2>{t('welcome.title')}</h2>
				<p className="lede">{t('welcome.lede')}</p>
				<form onSubmit={submit}>
					<label className="field">
						<span>{t('welcome.nameLabel')}</span>
						<input
							className="input"
							value={name}
							onChange={e => setName(e.target.value)}
							placeholder={t('welcome.namePlaceholder')}
							maxLength={64}
							autoFocus
							autoComplete="off"
						/>
					</label>
					{error && <p className="error-text">{error}</p>}
					<button className="btn" disabled={busy || !name.trim()}>
						{busy ? t('welcome.submitting') : t('welcome.submit')}
					</button>
					<p className="hint">{t('welcome.hint')}</p>
				</form>
			</section>
		</div>
	)
}
