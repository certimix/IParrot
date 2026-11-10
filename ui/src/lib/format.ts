import { getLanguage, translate } from '../i18n'

// Os formatadores são criados por idioma e reaproveitados: montar um
// Intl.DateTimeFormat é caro, e a lista de conversas formata muitas datas.
const cache = new Map<string, Intl.DateTimeFormat>()

function fmt(kind: 'time' | 'weekday' | 'shortDate' | 'longDate'): Intl.DateTimeFormat {
	const lang = getLanguage()
	const key = `${lang}:${kind}`
	let f = cache.get(key)
	if (!f) {
		const locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es' : 'en'
		const options: Record<typeof kind, Intl.DateTimeFormatOptions> = {
			time: { hour: '2-digit', minute: '2-digit' },
			weekday: { weekday: 'long' },
			shortDate: { day: '2-digit', month: '2-digit' },
			longDate: { day: 'numeric', month: 'long', year: 'numeric' },
		}
		f = new Intl.DateTimeFormat(locale, options[kind])
		cache.set(key, f)
	}
	return f
}

function dayStart(ms: number) {
	const d = new Date(ms)
	d.setHours(0, 0, 0, 0)
	return d.getTime()
}

function daysAgo(ms: number) {
	return Math.round((dayStart(Date.now()) - dayStart(ms)) / 86_400_000)
}

export function clock(ms: number) {
	return fmt('time').format(ms)
}

/** Para a lista de conversas: hora de hoje, "ontem", dia da semana ou data curta. */
export function listStamp(ms: number) {
	if (!ms) return ''
	const d = daysAgo(ms)
	if (d <= 0) return fmt('time').format(ms)
	if (d === 1) return translate('date.yesterdayShort')
	// "segunda-feira" vira "segunda": na lista o espaço é curto.
	if (d < 7) return fmt('weekday').format(ms).replace('-feira', '')
	return fmt('shortDate').format(ms)
}

/** Para o separador de dias dentro da conversa. */
export function dayLabel(ms: number) {
	const d = daysAgo(ms)
	if (d <= 0) return translate('date.today')
	if (d === 1) return translate('date.yesterday')
	if (d < 7) return capitalize(fmt('weekday').format(ms))
	return fmt('longDate').format(ms)
}

export function sameDay(a: number, b: number) {
	return dayStart(a) === dayStart(b)
}

function capitalize(s: string) {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

export function initials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean)
	if (parts.length === 0) return '?'
	const first = parts[0]?.[0] ?? ''
	const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
	return (first + last).toUpperCase()
}

/** Cor estável por pessoa, tirada da paleta herdada do Berty. */
const AVATAR_TONES = ['#535AE4', '#F64278', '#3F426D', '#2D3691', '#7474DC', '#9F0F8A', '#5C0778', '#A7035E']

export function toneFor(key: string) {
	let h = 0
	for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
	return AVATAR_TONES[h % AVATAR_TONES.length] ?? '#535AE4'
}

export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch {
		return false
	}
}
