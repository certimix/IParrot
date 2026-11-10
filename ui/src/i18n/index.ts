import { useSyncExternalStore } from 'react'
import { en } from './en'
import { es } from './es'
import { pt, type Dictionary, type TranslationKey } from './pt'

export type Language = 'pt' | 'en' | 'es'

const DICTS: Record<Language, Dictionary> = { pt, en, es }

export const LANGUAGES: { id: Language; label: string }[] = [
	{ id: 'pt', label: 'Português' },
	{ id: 'en', label: 'English' },
	{ id: 'es', label: 'Español' },
]

const STORAGE_KEY = 'iparrot.language'

function detect(): Language {
	try {
		const saved = localStorage.getItem(STORAGE_KEY)
		if (saved === 'pt' || saved === 'en' || saved === 'es') return saved
	} catch {
		// sem armazenamento: usa o idioma do sistema
	}
	for (const tag of navigator.languages ?? [navigator.language]) {
		const base = tag?.slice(0, 2).toLowerCase()
		if (base === 'pt' || base === 'en' || base === 'es') return base
	}
	return 'pt'
}

let current: Language = detect()
const listeners = new Set<() => void>()

/** Troca o idioma e redesenha a interface. */
export function setLanguage(language: Language) {
	if (language === current) return
	current = language
	try {
		localStorage.setItem(STORAGE_KEY, language)
	} catch {
		// vale só para esta sessão
	}
	document.documentElement.lang = language === 'pt' ? 'pt-BR' : language
	for (const l of listeners) l()
}

export function getLanguage(): Language {
	return current
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/**
 * Traduz uma chave. `{algo}` nos textos é trocado pelos valores passados.
 * A chave é verificada em tempo de compilação: errar o nome não compila.
 */
export function translate(key: TranslationKey, values?: Record<string, string | number>): string {
	const text = DICTS[current][key] ?? pt[key]
	if (!values) return text
	return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
		const value = values[name]
		return value === undefined ? whole : String(value)
	})
}

/** Hook da interface: devolve `t` e redesenha quando o idioma muda. */
export function useT() {
	useSyncExternalStore(subscribe, getLanguage, getLanguage)
	return translate
}

export type { TranslationKey }

/** Hook que devolve o idioma atual e redesenha quando ele muda. */
export function useLanguage(): Language {
	return useSyncExternalStore(subscribe, getLanguage, getLanguage)
}
