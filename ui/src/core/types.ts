// Contrato entre a interface e o núcleo Go (espelha core/api/types.go).

export type ContactState =
	| 'IncomingRequest'
	| 'OutgoingRequestEnqueued'
	| 'OutgoingRequestSent'
	| 'Accepted'
	| 'Undefined'

export type ConversationType = 'AccountType' | 'ContactType' | 'MultiMemberType' | 'Undefined'

export interface Account {
	publicKey: string
	displayName: string
	link: string
}

export interface Contact {
	publicKey: string
	conversationPublicKey: string
	displayName: string
	state: ContactState
	createdDate: number
	sentDate: number
}

export interface Conversation {
	publicKey: string
	type: ConversationType
	displayName: string
	link: string
	unreadCount: number
	lastUpdate: number
	createdDate: number
	contactPublicKey: string
	accountMemberPublicKey: string
	isOpen: boolean
	/** Milissegundos; 0 = não silenciada. */
	mutedUntil: number
}

export interface Member {
	publicKey: string
	conversationPublicKey: string
	displayName: string
	isMe: boolean
	isCreator: boolean
}

export interface Interaction {
	cid: string
	type: string
	conversationPublicKey: string
	memberPublicKey: string
	isMine: boolean
	acknowledged: boolean
	sentDate: number
	targetCid?: string
	text?: string
	invitationLink?: string
	displayName?: string
}

export interface CoreNotification {
	kind: string
	title: string
	body: string
}

export type CoreEvent =
	| { type: 'listEnded'; isNew: boolean }
	| { type: 'account'; isNew: boolean; account: Account }
	| { type: 'contact'; isNew: boolean; contact: Contact }
	| { type: 'conversation'; isNew: boolean; conversation: Conversation }
	| { type: 'conversationDeleted'; isNew: boolean; publicKey: string }
	| { type: 'member'; isNew: boolean; member: Member }
	| { type: 'interaction'; isNew: boolean; interaction: Interaction }
	| { type: 'interactionDeleted'; isNew: boolean; cid: string; publicKey: string }
	| { type: 'history'; isNew: boolean; publicKey: string; interactions?: Interaction[] }
	| { type: 'notification'; isNew: boolean; notification: CoreNotification }

export interface ShareInfo {
	link: string
	displayName: string
}

export interface ParsedLink {
	kind: 'contact' | 'group' | 'unknown'
	displayName: string
}

export interface NetworkPeer {
	id: string
	active: boolean
	latencyMs: number
	features: string[]
	routeCount: number
}

export interface Servers {
	rdvp: string[]
	relays: string[]
}

export interface ExportResult {
	path: string
	bytes: number
}

export interface NetworkInfo {
	peerId: string
	listeners: string[]
	connectedPeers: number
	peers: NetworkPeer[]
	goVersion: string
	os: string
	arch: string
}

/** Tudo que a interface sabe pedir ao núcleo. */
export interface Core {
	/** 'p2p' = núcleo real; 'demo' = dados simulados no navegador. */
	readonly mode: 'p2p' | 'demo'
	readonly version: string

	/** Abre o fluxo de eventos. Devolve a função que encerra a assinatura. */
	subscribe(onEvent: (ev: CoreEvent) => void, onStatus: (online: boolean) => void): () => void

	getAccount(): Promise<Account>
	updateAccount(displayName: string): Promise<Account>
	share(reset?: boolean): Promise<ShareInfo>
	parseLink(link: string): Promise<ParsedLink>
	requestContact(link: string): Promise<void>
	acceptContact(publicKey: string): Promise<void>
	createGroup(displayName: string, contacts: string[]): Promise<string>
	joinGroup(link: string): Promise<void>
	groupLink(publicKey: string, displayName: string): Promise<string>
	muteConversation(publicKey: string, muted: boolean): Promise<void>
	hideConversation(publicKey: string, hidden: boolean): Promise<void>
	leaveGroup(publicKey: string): Promise<void>
	blockContact(publicKey: string, conversationPublicKey: string, blocked: boolean): Promise<void>
	blockedContacts(): Promise<string[]>
	openConversation(publicKey: string): Promise<void>
	closeConversation(publicKey: string): Promise<void>
	loadOlder(publicKey: string, refCid: string, amount?: number): Promise<void>
	sendMessage(conversation: string, text: string): Promise<string>
	search(query: string): Promise<Interaction[]>
	network(): Promise<NetworkInfo>
	servers(): Promise<Servers>
	setServers(servers: Servers): Promise<void>
	exportAccount(): Promise<ExportResult>
}
