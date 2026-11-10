import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useT } from '../i18n'

interface Props {
	title: string
	onClose(): void
	/** Se informado, mostra "voltar" em vez de só fechar. */
	onBack?: () => void
	wide?: boolean
	flush?: boolean
	children: ReactNode
}

/** Janela sobreposta: diálogo central no desktop, folha inferior no celular. */
export function Panel({ title, onClose, onBack, wide, flush, children }: Props) {
	const t = useT()
	const ref = useRef<HTMLDivElement>(null)
	// onClose muda a cada renderização; a ref evita refazer o efeito (e roubar o foco de quem digita).
	const closeRef = useRef(onClose)
	closeRef.current = onClose

	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null
		if (!ref.current?.contains(document.activeElement)) ref.current?.focus()
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeRef.current()
		}
		window.addEventListener('keydown', onKey)
		return () => {
			window.removeEventListener('keydown', onKey)
			previous?.focus?.()
		}
	}, [])

	return (
		<div className="scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}>
			<div ref={ref} className={`panel${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
				<div className="panel-head">
					{onBack && (
						<button className="icon-btn" onClick={onBack} aria-label={t('common.back')}>
							<ArrowLeft size={22} />
						</button>
					)}
					<h2>{title}</h2>
					<button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
						<X size={22} />
					</button>
				</div>
				<div className={`panel-body${flush ? ' flush' : ''}`}>{children}</div>
			</div>
		</div>
	)
}
