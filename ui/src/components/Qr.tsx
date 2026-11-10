import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** QR Code em SVG, nas cores da marca. Gerado localmente, sem serviço externo. */
export function Qr({ value, label }: { value: string; label: string }) {
	const { size, path } = useMemo(() => {
		const qr = qrcode(0, 'M')
		qr.addData(value)
		qr.make()
		const n = qr.getModuleCount()
		let d = ''
		for (let r = 0; r < n; r++) {
			for (let c = 0; c < n; c++) {
				if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
			}
		}
		return { size: n, path: d }
	}, [value])

	return (
		<svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label={label} shapeRendering="crispEdges">
			<rect x={-2} y={-2} width={size + 4} height={size + 4} fill="#fff" />
			<path d={path} fill="#2D3691" />
		</svg>
	)
}
