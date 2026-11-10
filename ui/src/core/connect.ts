import { Capacitor, registerPlugin } from '@capacitor/core'
import { DemoCore } from './demo'
import { HttpCore } from './http'
import type { Core } from './types'

interface CoreInfo {
	url: string
	port: number
	token: string
	version: string
}

interface IParrotCorePlugin {
	start(): Promise<CoreInfo>
}

declare global {
	interface Window {
		// Ponte do Wails (desktop): métodos do struct App em main.go.
		go?: { main?: { App?: { CoreInfo(): Promise<CoreInfo> } } }
	}
}

const TOKEN_KEY = 'iparrot.token'

/**
 * Descobre onde está o núcleo, nesta ordem:
 *  1. Desktop (Wails)        — o Go embutido informa URL e token.
 *  2. Android/iOS (Capacitor) — o plugin nativo sobe o núcleo gomobile.
 *  3. iparrotd                — a interface é servida pelo próprio núcleo; token em #token=.
 *  4. Desenvolvimento         — VITE_CORE_URL + VITE_CORE_TOKEN.
 *  5. Nenhum núcleo           — modo demonstração, com dados simulados.
 */
export async function connect(): Promise<Core> {
	const wails = window.go?.main?.App
	if (wails) {
		const info = await wails.CoreInfo()
		return new HttpCore(info.url, info.token, info.version)
	}

	if (Capacitor.isNativePlatform()) {
		const plugin = registerPlugin<IParrotCorePlugin>('IParrotCore')
		const info = await plugin.start()
		return new HttpCore(info.url, info.token, info.version)
	}

	const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('token')
	if (fromHash) {
		safeSession('set', fromHash)
		history.replaceState(null, '', window.location.pathname)
	}
	const sameOriginToken = fromHash ?? safeSession('get')
	if (sameOriginToken && window.location.protocol.startsWith('http')) {
		const version = await probe(window.location.origin, sameOriginToken)
		if (version) return new HttpCore(window.location.origin, sameOriginToken, version)
	}

	const devUrl = import.meta.env.VITE_CORE_URL as string | undefined
	const devToken = import.meta.env.VITE_CORE_TOKEN as string | undefined
	if (devUrl && devToken) {
		const version = await probe(devUrl, devToken)
		if (version) return new HttpCore(devUrl, devToken, version)
	}

	return new DemoCore()
}

async function probe(baseUrl: string, token: string): Promise<string | null> {
	try {
		const res = await fetch(`${baseUrl}/api/v1/status`, { headers: { Authorization: `Bearer ${token}` } })
		if (!res.ok) return null
		const data = (await res.json()) as { version?: string }
		return data.version ?? '?'
	} catch {
		return null
	}
}

function safeSession(op: 'get' | 'set', value?: string): string | null {
	try {
		if (op === 'set' && value) sessionStorage.setItem(TOKEN_KEY, value)
		return sessionStorage.getItem(TOKEN_KEY)
	} catch {
		return null
	}
}
