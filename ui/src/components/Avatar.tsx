import { Users } from 'lucide-react'
import { initials, toneFor } from '../lib/format'

interface Props {
	name: string
	/** Chave estável (chave pública) para a cor não mudar se o nome mudar. */
	id: string
	size?: 's' | 'm' | 'l'
	group?: boolean
}

export function Avatar({ name, id, size = 'm', group = false }: Props) {
	const cls = ['avatar', size === 'm' ? '' : size, group ? 'group' : ''].filter(Boolean).join(' ')
	return (
		<span className={cls} style={{ background: toneFor(id) }} aria-hidden>
			{group ? <Users size={size === 's' ? 15 : size === 'l' ? 32 : 22} /> : initials(name)}
		</span>
	)
}
