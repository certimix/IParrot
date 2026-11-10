import { Ban, BellOff, BellRing, EyeOff, LogOut, Users } from 'lucide-react'
import { useState } from 'react'
import { Panel } from '../components/Panel'
import { useT, type TranslationKey } from '../i18n'
import { conversationName, useStore, type ConfirmAction } from '../store'

/** Menu de ações de uma conversa: silenciar, ocultar, sair, bloquear. */
export function ConversationActionsPanel({ publicKey }: { publicKey: string }) {
	const core = useStore(s => s.core)
	const conversation = useStore(s => s.conversations[publicKey])
	const contacts = useStore(s => s.contacts)
	const open = useStore(s => s.open)
	const notify = useStore(s => s.notify)
	const t = useT()
	const [busy, setBusy] = useState(false)

	if (!conversation) return null

	const close = () => open(null)
	const isGroup = conversation.type === 'MultiMemberType'
	const name = conversationName(conversation, contacts)
	const muted = conversation.mutedUntil > Date.now()

	const toggleMute = async () => {
		if (!core) return
		setBusy(true)
		try {
			await core.muteConversation(publicKey, !muted)
			notify(muted ? t('actions.unmuted', { name }) : t('actions.muted', { name }))
			close()
		} catch (err) {
			notify(err instanceof Error ? err.message : t('actions.muteFailed'))
		} finally {
			setBusy(false)
		}
	}

	const confirm = (action: ConfirmAction) => open({ name: 'confirm', action })

	return (
		<Panel title={name} onClose={close} onBack={isGroup ? () => open({ name: 'groupInfo', publicKey }) : undefined} flush>
			<button className="row" onClick={() => void toggleMute()} disabled={busy}>
				{muted ? <BellRing size={20} aria-hidden /> : <BellOff size={20} aria-hidden />}
				<div className="body">
					<div className="name">{muted ? t('actions.unmute') : t('actions.mute')}</div>
					<div className="preview">{muted ? t('actions.unmuteDetail') : t('actions.muteDetail')}</div>
				</div>
			</button>

			{isGroup && (
				<button className="row" onClick={() => open({ name: 'groupInfo', publicKey })}>
					<Users size={20} aria-hidden />
					<div className="body">
						<div className="name">{t('actions.members')}</div>
						<div className="preview">{t('actions.membersDetail')}</div>
					</div>
				</button>
			)}

			<button className="row" onClick={() => confirm({ kind: 'hide', publicKey, name })}>
				<EyeOff size={20} aria-hidden />
				<div className="body">
					<div className="name">{t('actions.hide')}</div>
					<div className="preview">{t('actions.hideDetail')}</div>
				</div>
			</button>

			{isGroup ? (
				<button className="row danger" onClick={() => confirm({ kind: 'leave', publicKey, name })}>
					<LogOut size={20} aria-hidden />
					<div className="body">
						<div className="name">{t('actions.leave')}</div>
						<div className="preview">{t('actions.leaveDetail')}</div>
					</div>
				</button>
			) : (
				<button
					className="row danger"
					onClick={() =>
						confirm({
							kind: 'block',
							publicKey: conversation.contactPublicKey,
							conversationPublicKey: publicKey,
							name,
						})
					}
				>
					<Ban size={20} aria-hidden />
					<div className="body">
						<div className="name">{t('actions.block', { name })}</div>
						<div className="preview">{t('actions.blockDetail')}</div>
					</div>
				</button>
			)}
		</Panel>
	)
}

// As chaves do dicionário seguem o nome da ação: confirm.<kind>.<parte>.
const CONFIRM_KEYS = {
	hide: ['confirm.hide.title', 'confirm.hide.body', 'confirm.hide.confirm', 'confirm.hide.done'],
	leave: ['confirm.leave.title', 'confirm.leave.body', 'confirm.leave.confirm', 'confirm.leave.done'],
	block: ['confirm.block.title', 'confirm.block.body', 'confirm.block.confirm', 'confirm.block.done'],
} as const satisfies Record<ConfirmAction['kind'], readonly TranslationKey[]>

/** Confirmação das ações que não dá para desfazer com um toque. */
export function ConfirmPanel({ action }: { action: ConfirmAction }) {
	const core = useStore(s => s.core)
	const open = useStore(s => s.open)
	const notify = useStore(s => s.notify)
	const resync = useStore(s => s.resync)
	const t = useT()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	const [titleKey, bodyKey, confirmKey, doneKey] = CONFIRM_KEYS[action.kind]
	const close = () => open(null)

	const run = async () => {
		if (!core) return
		setBusy(true)
		setError('')
		try {
			switch (action.kind) {
				case 'hide':
					await core.hideConversation(action.publicKey, true)
					break
				case 'leave':
					await core.leaveGroup(action.publicKey)
					break
				case 'block':
					await core.blockContact(action.publicKey, action.conversationPublicKey ?? '', true)
					break
			}
			close()
			// O fluxo de eventos passa a filtrar o que foi escondido; reassinar
			// deixa a lista igual ao que o núcleo agora entrega.
			resync()
			notify(`${action.name}: ${t(doneKey)}`)
		} catch (err) {
			setError(err instanceof Error ? err.message : t('actions.failed'))
		} finally {
			setBusy(false)
		}
	}

	return (
		<Panel title={t(titleKey)} onClose={close}>
			<p>
				<strong>{action.name}</strong>
			</p>
			<p className="hint">{t(bodyKey)}</p>
			{error && <p className="error-text">{error}</p>}
			<div className="actions">
				<button className="btn quiet" onClick={close} disabled={busy}>
					{t('common.cancel')}
				</button>
				<button className="btn danger" onClick={() => void run()} disabled={busy}>
					{busy ? t('common.wait') : t(confirmKey)}
				</button>
			</div>
		</Panel>
	)
}
