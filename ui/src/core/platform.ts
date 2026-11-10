import { Capacitor, registerPlugin } from '@capacitor/core'

interface IParrotCoreNative {
	startBackgroundService(): Promise<void>
	stopBackgroundService(): Promise<void>
	notifyMessage(options: { title: string; body: string; conversation?: string }): Promise<void>
	ensureNotificationPermission(): Promise<{ granted: boolean }>
}

function native(): IParrotCoreNative | null {
	return Capacitor.isNativePlatform() ? registerPlugin<IParrotCoreNative>('IParrotCore') : null
}

/**
 * Avisos do sistema para mensagens que chegam com o IParrot em segundo plano.
 *
 * No Android e no iOS quem mostra é o app nativo; no desktop e no navegador,
 * a API de notificação do próprio sistema. Em qualquer caso, nada é mostrado
 * enquanto a janela está à vista: ali a mensagem já aparece na conversa.
 */
export const notifications = {
	/** Pede permissão uma vez. Devolve false se não der para notificar. */
	async request(): Promise<boolean> {
		const plugin = native()
		if (plugin) {
			try {
				return (await plugin.ensureNotificationPermission()).granted
			} catch {
				return false
			}
		}
		if (typeof Notification === 'undefined') return false
		if (Notification.permission === 'granted') return true
		if (Notification.permission === 'denied') return false
		try {
			return (await Notification.requestPermission()) === 'granted'
		} catch {
			return false
		}
	},

	/** Mostra o aviso. Silencioso se a permissão não existe. */
	async show(title: string, body: string, conversation?: string): Promise<void> {
		const plugin = native()
		if (plugin) {
			try {
				await plugin.notifyMessage({ title, body, conversation })
			} catch {
				// sem permissão ou sem suporte: o aviso é opcional
			}
			return
		}
		if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
		try {
			const n = new Notification(title, { body, icon: './logo-icon.svg', tag: conversation })
			n.onclick = () => {
				window.focus()
				n.close()
			}
		} catch {
			// alguns WebViews têm o objeto mas não o construtor
		}
	},
}

/**
 * Mantém o nó P2P no ar com o app em segundo plano.
 *
 * Só o Android precisa disso: o sistema encerra processos em segundo plano, e
 * o serviço em primeiro plano é a forma oficial de evitar isso. No desktop o
 * processo já é do usuário, e no iOS o sistema não permite equivalente — lá a
 * entrega acontece quando o app volta a ficar aberto.
 */
export const background = {
	supported(): boolean {
		return Capacitor.getPlatform() === 'android'
	},

	async start(): Promise<void> {
		if (!this.supported()) return
		try {
			await native()?.startBackgroundService()
		} catch {
			// sem o serviço o app ainda funciona aberto
		}
	},

	async stop(): Promise<void> {
		if (!this.supported()) return
		try {
			await native()?.stopBackgroundService()
		} catch {
			// nada a fazer: o serviço cai junto com o processo
		}
	},
}

/** Nome da plataforma, para textos que mudam conforme o aparelho. */
export function platformName(): 'android' | 'ios' | 'desktop' | 'web' {
	const p = Capacitor.getPlatform()
	if (p === 'android' || p === 'ios') return p
	return window.go?.main?.App ? 'desktop' : 'web'
}
