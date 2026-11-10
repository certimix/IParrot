import { useEffect } from 'react'
import { useT } from './i18n'
import { ParrotMark } from './components/ParrotMark'
import { Chat } from './screens/Chat'
import { ConfirmPanel, ConversationActionsPanel } from './screens/ConversationActions'
import { AddPanel, GroupInfoPanel, NewGroupPanel, SharePanel } from './screens/Panels'
import { SettingsPanel } from './screens/Settings'
import { Sidebar } from './screens/Sidebar'
import { Welcome } from './screens/Welcome'
import { useStore } from './store'

export function App() {
	const phase = useStore(s => s.phase)
	const failure = useStore(s => s.failure)
	const loaded = useStore(s => s.loaded)
	const account = useStore(s => s.account)
	const active = useStore(s => s.active)
	const panel = useStore(s => s.panel)
	const toast = useStore(s => s.toast)
	const start = useStore(s => s.start)
	const t = useT()

	useEffect(() => {
		void start()
	}, [start])

	if (phase === 'failed') {
		return (
			<div className="splash on-brand">
				<div>
					<ParrotMark className="mark" />
					<h1>{t('splash.failedTitle')}</h1>
					<p>{failure || t('splash.failedBody')}</p>
					<button className="btn" onClick={() => void start()}>
						{t('splash.retry')}
					</button>
				</div>
			</div>
		)
	}

	if (phase === 'connecting' || !loaded) {
		return (
			<div className="splash" role="status">
				<div>
					<ParrotMark className="mark waiting" />
					<h1>{t('app.name')}</h1>
					<p>{t('splash.preparing')}</p>
				</div>
			</div>
		)
	}

	if (!account?.displayName) return <Welcome />

	return (
		<div className="app" data-pane={active ? 'chat' : 'list'}>
			<Sidebar />
			<main className="main">
				{active ? (
					<Chat publicKey={active} />
				) : (
					<div className="blank">
						<div>
							<ParrotMark className="mark" />
							<h2>{t('chat.pickTitle')}</h2>
							<p>{t('chat.pickBody')}</p>
						</div>
					</div>
				)}
			</main>

			{panel?.name === 'share' && <SharePanel />}
			{panel?.name === 'add' && <AddPanel />}
			{panel?.name === 'newGroup' && <NewGroupPanel />}
			{panel?.name === 'groupInfo' && <GroupInfoPanel publicKey={panel.publicKey} />}
			{panel?.name === 'conversationActions' && <ConversationActionsPanel publicKey={panel.publicKey} />}
			{panel?.name === 'confirm' && <ConfirmPanel action={panel.action} />}
			{panel?.name === 'settings' && <SettingsPanel page={panel.page} />}

			{toast && (
				<div className="toast" role="status" key={toast.id}>
					{toast.text}
				</div>
			)}
		</div>
	)
}
