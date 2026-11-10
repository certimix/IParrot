import jsQR from 'jsqr'
import { Camera, Image as ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useT } from '../i18n'

interface Props {
	/** Chamado com o texto lido. Só dispara uma vez. */
	onRead(text: string): void
	/** Texto de apoio abaixo da imagem da câmera. */
	hint?: string
}

type Phase = 'starting' | 'scanning' | 'denied' | 'unavailable'

/**
 * Lê um QR Code pela câmera do aparelho.
 *
 * Usa o BarcodeDetector do navegador quando existe (Android e Chrome o têm, e
 * é bem mais rápido) e cai para o jsQR em canvas nos demais, incluindo iOS.
 * Quando não há câmera — ou a pessoa prefere — dá para escolher uma foto.
 */
export function QrScanner({ onRead, hint }: Props) {
	const video = useRef<HTMLVideoElement>(null)
	const canvas = useRef<HTMLCanvasElement>(null)
	const t = useT()
	const [phase, setPhase] = useState<Phase>('starting')
	const [message, setMessage] = useState('')
	// Evita disparar onRead duas vezes se o quadro seguinte trouxer o mesmo código.
	const done = useRef(false)
	const readRef = useRef(onRead)
	readRef.current = onRead

	useEffect(() => {
		let stream: MediaStream | null = null
		let raf = 0
		let timer = 0
		let stopped = false

		const stop = () => {
			stopped = true
			cancelAnimationFrame(raf)
			clearTimeout(timer)
			stream?.getTracks().forEach(t => t.stop())
		}

		const finish = (text: string) => {
			if (done.current || !text) return
			done.current = true
			stop()
			readRef.current(text)
		}

		const start = async () => {
			if (!navigator.mediaDevices?.getUserMedia) {
				setPhase('unavailable')
				setMessage(t('scanner.unsupported'))
				return
			}
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment' },
					audio: false,
				})
			} catch (err) {
				const name = err instanceof DOMException ? err.name : ''
				setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
				setMessage(name === 'NotAllowedError' || name === 'SecurityError' ? t('scanner.denied') : t('scanner.failed'))
				return
			}
			if (stopped) {
				stream.getTracks().forEach(t => t.stop())
				return
			}

			const el = video.current
			if (!el) return
			el.srcObject = stream
			try {
				await el.play()
			} catch {
				// alguns navegadores só tocam depois de um toque; o loop abaixo segue tentando
			}
			setPhase('scanning')

			// Caminho rápido: detector nativo do navegador.
			const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorLike }).BarcodeDetector
			if (Detector) {
				try {
					const detector = new Detector({ formats: ['qr_code'] })
					const tick = async () => {
						if (stopped || done.current) return
						try {
							const found = await detector.detect(el)
							if (found[0]?.rawValue) return finish(found[0].rawValue)
						} catch {
							// um quadro ruim não interrompe a leitura
						}
						timer = window.setTimeout(tick, 150)
					}
					void tick()
					return
				} catch {
					// detector indisponível na prática: segue para o jsQR
				}
			}

			// Caminho compatível: desenha o quadro num canvas e decodifica.
			const scan = () => {
				if (stopped || done.current) return
				const c = canvas.current
				if (c && el.videoWidth > 0) {
					const w = Math.min(el.videoWidth, 640)
					const h = Math.round((w / el.videoWidth) * el.videoHeight)
					c.width = w
					c.height = h
					const ctx = c.getContext('2d', { willReadFrequently: true })
					if (ctx) {
						ctx.drawImage(el, 0, 0, w, h)
						const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
						if (code?.data) return finish(code.data)
					}
				}
				raf = requestAnimationFrame(scan)
			}
			raf = requestAnimationFrame(scan)
		}

		void start()
		return stop
	}, [])

	const fromFile = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (!file) return
		setMessage('')
		try {
			const bitmap = await createImageBitmap(file)
			const c = document.createElement('canvas')
			const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
			c.width = Math.round(bitmap.width * scale)
			c.height = Math.round(bitmap.height * scale)
			const ctx = c.getContext('2d', { willReadFrequently: true })
			if (!ctx) throw new Error('sem canvas')
			ctx.drawImage(bitmap, 0, 0, c.width, c.height)
			bitmap.close?.()
			const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height)
			if (code?.data) {
				done.current = true
				readRef.current(code.data)
			} else {
				setMessage(t('scanner.notFound'))
			}
		} catch {
			setMessage(t('scanner.badImage'))
		}
	}

	return (
		<div className="scanner">
			<div className="viewport" data-state={phase}>
				<video ref={video} playsInline muted aria-label={t('scanner.cameraLabel')} />
				<canvas ref={canvas} hidden />
				<div className="reticle" aria-hidden />
				{phase === 'starting' && <p className="overlay">{t('scanner.opening')}</p>}
				{(phase === 'denied' || phase === 'unavailable') && (
					<p className="overlay">
						<Camera size={22} aria-hidden /> {t('scanner.noCamera')}
					</p>
				)}
			</div>

			<p className="hint center">{message || hint || t('scanner.aim')}</p>

			<label className="btn quiet wide">
				<ImageIcon size={18} aria-hidden /> {t('scanner.pickPhoto')}
				<input type="file" accept="image/*" onChange={e => void fromFile(e)} hidden />
			</label>
		</div>
	)
}

// Tipagem mínima do BarcodeDetector, que o TypeScript ainda não traz.
interface BarcodeDetectorLike {
	new (options?: { formats?: string[] }): {
		detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
	}
}
