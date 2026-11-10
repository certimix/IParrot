import type {
	Account,
	Core,
	CoreEvent,
	ExportResult,
	Interaction,
	NetworkInfo,
	ParsedLink,
	Servers,
	ShareInfo,
} from './types'

export class CoreError extends Error {}

/** Cliente do núcleo Go via HTTP local (loopback + token). */
export class HttpCore implements Core {
	readonly mode = 'p2p' as const

	constructor(
		private readonly baseUrl: string,
		private readonly token: string,
		readonly version: string,
	) {}

	private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
		let res: Response
		try {
			res = await fetch(this.baseUrl + path, {
				method,
				headers: {
					Authorization: `Bearer ${this.token}`,
					...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
				},
				body: body !== undefined ? JSON.stringify(body) : undefined,
			})
		} catch {
			throw new CoreError('Sem resposta do núcleo IParrot. Verifique se o app ainda está aberto.')
		}
		const data = (await res.json().catch(() => null)) as { error?: string } | null
		if (!res.ok) {
			throw new CoreError(data?.error ?? `O núcleo respondeu com erro ${res.status}.`)
		}
		return data as T
	}

	subscribe(onEvent: (ev: CoreEvent) => void, onStatus: (online: boolean) => void): () => void {
		const controller = new AbortController()
		let stopped = false

		// fetch + ReadableStream em vez de EventSource: permite mandar o token no cabeçalho.
		const run = async () => {
			let delay = 500
			while (!stopped) {
				try {
					const res = await fetch(`${this.baseUrl}/api/v1/events?history=30`, {
						headers: { Authorization: `Bearer ${this.token}`, Accept: 'text/event-stream' },
						signal: controller.signal,
					})
					if (!res.ok || !res.body) throw new Error(`status ${res.status}`)
					onStatus(true)
					delay = 500

					const reader = res.body.getReader()
					const decoder = new TextDecoder()
					let buffer = ''
					for (;;) {
						const { done, value } = await reader.read()
						if (done) break
						buffer += decoder.decode(value, { stream: true })
						let cut = buffer.indexOf('\n\n')
						while (cut !== -1) {
							const block = buffer.slice(0, cut)
							buffer = buffer.slice(cut + 2)
							for (const line of block.split('\n')) {
								if (!line.startsWith('data:')) continue
								try {
									onEvent(JSON.parse(line.slice(5).trim()) as CoreEvent)
								} catch {
									// evento malformado: ignora só este
								}
							}
							cut = buffer.indexOf('\n\n')
						}
					}
				} catch {
					// cai no reconectar abaixo
				}
				if (stopped) return
				onStatus(false)
				await new Promise(r => setTimeout(r, delay))
				delay = Math.min(delay * 2, 8000)
			}
		}
		void run()

		return () => {
			stopped = true
			controller.abort()
		}
	}

	getAccount() {
		return this.call<Account>('GET', '/api/v1/account')
	}
	updateAccount(displayName: string) {
		return this.call<Account>('POST', '/api/v1/account', { displayName })
	}
	share(reset = false) {
		return this.call<ShareInfo>('GET', `/api/v1/share${reset ? '?reset=1' : ''}`)
	}
	parseLink(link: string) {
		return this.call<ParsedLink>('POST', '/api/v1/links/parse', { link })
	}
	async requestContact(link: string) {
		await this.call('POST', '/api/v1/contacts/request', { link })
	}
	async acceptContact(publicKey: string) {
		await this.call('POST', '/api/v1/contacts/accept', { publicKey })
	}
	async createGroup(displayName: string, contacts: string[]) {
		const r = await this.call<{ publicKey: string }>('POST', '/api/v1/groups', { displayName, contacts })
		return r.publicKey
	}
	async joinGroup(link: string) {
		await this.call('POST', '/api/v1/groups/join', { link })
	}
	async groupLink(publicKey: string, displayName: string) {
		const r = await this.call<{ link: string }>('POST', '/api/v1/groups/link', { publicKey, displayName })
		return r.link
	}
	async muteConversation(publicKey: string, muted: boolean) {
		await this.call('POST', '/api/v1/conversations/mute', { publicKey, muted })
	}
	async hideConversation(publicKey: string, hidden: boolean) {
		await this.call('POST', '/api/v1/conversations/hide', { publicKey, hidden })
	}
	async leaveGroup(publicKey: string) {
		await this.call('POST', '/api/v1/groups/leave', { publicKey })
	}
	async blockContact(publicKey: string, conversationPublicKey: string, blocked: boolean) {
		await this.call('POST', '/api/v1/contacts/block', { publicKey, conversationPublicKey, blocked })
	}
	async blockedContacts() {
		const r = await this.call<{ blocked: string[] }>('GET', '/api/v1/blocked')
		return r.blocked ?? []
	}
	async openConversation(publicKey: string) {
		await this.call('POST', '/api/v1/conversations/open', { publicKey })
	}
	async closeConversation(publicKey: string) {
		await this.call('POST', '/api/v1/conversations/close', { publicKey })
	}
	async loadOlder(publicKey: string, refCid: string, amount = 30) {
		await this.call('POST', '/api/v1/conversations/load', { publicKey, refCid, amount })
	}
	async sendMessage(conversation: string, text: string) {
		const r = await this.call<{ cid: string }>('POST', '/api/v1/messages', { conversation, text })
		return r.cid
	}
	async search(query: string) {
		const r = await this.call<{ results: Interaction[] }>('GET', `/api/v1/search?q=${encodeURIComponent(query)}`)
		return r.results
	}
	network() {
		return this.call<NetworkInfo>('GET', '/api/v1/network')
	}
	servers() {
		return this.call<Servers>('GET', '/api/v1/servers')
	}
	async setServers(servers: Servers) {
		await this.call('POST', '/api/v1/servers', servers)
	}
	exportAccount() {
		return this.call<ExportResult>('POST', '/api/v1/export', {})
	}
}
