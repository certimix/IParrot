/**
 * Português do Brasil — idioma de origem do IParrot.
 *
 * Este arquivo é a fonte da verdade: as outras línguas são tipadas a partir
 * dele, então esquecer uma chave em `en.ts` ou `es.ts` vira erro de compilação.
 *
 * `{algo}` é substituído em tempo de execução. Mantenha o mesmo nome em todas
 * as traduções.
 */
export const pt = {
	// --- geral ---
	'app.name': 'IParrot',
	'common.cancel': 'Cancelar',
	'common.back': 'Voltar',
	'common.close': 'Fechar',
	'common.wait': 'Aguarde…',
	'common.loading': 'Carregando…',
	'common.copy': 'Copiar',
	'common.copied': 'Copiado',
	'common.copyFailed': 'Não deu para copiar automaticamente. Selecione o código e copie.',

	// --- datas ---
	'date.today': 'Hoje',
	'date.yesterday': 'Ontem',
	'date.yesterdayShort': 'ontem',

	// --- abertura ---
	'splash.preparing': 'Preparando sua rede privada. Na primeira vez isso leva alguns segundos.',
	'splash.failedTitle': 'O IParrot não conseguiu iniciar',
	'splash.failedBody': 'O núcleo de rede não respondeu.',
	'splash.retry': 'Tentar de novo',

	// --- boas-vindas ---
	'welcome.headline': 'Sua conversa não passa por ninguém.',
	'welcome.title': 'Crie sua conta neste aparelho',
	'welcome.lede':
		'As mensagens vão direto de um aparelho ao outro, criptografadas, sem servidor no meio. O IParrot não pede telefone nem e-mail.',
	'welcome.nameLabel': 'Como você quer aparecer para seus contatos?',
	'welcome.namePlaceholder': 'Seu nome ou apelido',
	'welcome.submit': 'Criar minha conta',
	'welcome.submitting': 'Criando…',
	'welcome.hint': 'Sua identidade fica guardada só aqui. Dá para trocar o nome depois, em Configurações.',
	'welcome.error': 'Não foi possível salvar o nome. Tente de novo.',

	// --- lista de conversas ---
	'sidebar.searchLabel': 'Buscar conversas e mensagens',
	'sidebar.myCode': 'Meu código de contato',
	'sidebar.settings': 'Configurações',
	'sidebar.demoBanner': 'Modo demonstração: os contatos e as mensagens são simulados e nada sai deste navegador.',
	'sidebar.reconnecting': 'Reconectando ao núcleo do IParrot…',
	'sidebar.requests': 'Pedidos de contato',
	'sidebar.wantsToTalk': 'quer conversar com você',
	'sidebar.accept': 'Aceitar',
	'sidebar.accepting': 'Aceitando…',
	'sidebar.accepted': '{name} agora está nos seus contatos',
	'sidebar.acceptFailed': 'Não foi possível aceitar o pedido',
	'sidebar.conversations': 'Conversas',
	'sidebar.waiting': 'Aguardando resposta',
	'sidebar.waitingDetail': 'Pedido enviado. A conversa abre quando for aceito.',
	'sidebar.someone': 'Alguém',
	'sidebar.contact': 'Contato',
	'sidebar.loadingConversations': 'Carregando suas conversas…',
	'sidebar.emptyTitle': 'Nenhuma conversa ainda',
	'sidebar.emptyBody':
		'Toque em + para adicionar um contato pelo código dele, ou mostre o seu código para alguém.',
	'sidebar.noResultsTitle': 'Nada encontrado',
	'sidebar.noResultsBody': 'Nenhuma conversa ou mensagem com “{query}”.',
	'sidebar.newConversation': 'Nova conversa',
	'sidebar.addContact': 'Adicionar contato',
	'sidebar.newGroup': 'Criar grupo',
	'sidebar.previewYou': 'Você: {text}',
	'sidebar.previewInvitation': 'Convite para um grupo',
	'sidebar.previewEmpty': 'Sem mensagens ainda',
	'sidebar.unread': '{count} não lidas',

	// --- conversa ---
	'chat.backToList': 'Voltar para as conversas',
	'chat.encrypted': 'Criptografada de ponta a ponta',
	'chat.members': '{count} participantes. Toque para ver e convidar',
	'chat.membersOne': '1 participante. Toque para ver e convidar',
	'chat.actions': 'Ações da conversa',
	'chat.muted': 'Conversa silenciada',
	'chat.loadOlder': 'Carregar mensagens anteriores',
	'chat.loadingOlder': 'Carregando…',
	'chat.loadOlderFailed': 'Não foi possível carregar mensagens anteriores',
	'chat.emptyGroup': 'Grupo criado',
	'chat.emptyContact': 'Você e {name} estão conectados',
	'chat.emptyBody': 'Escreva a primeira mensagem. Ela é entregue quando os aparelhos se encontrarem na rede.',
	'chat.invitationTitle': 'Convite para um grupo',
	'chat.invitationMine': 'Você enviou este convite.',
	'chat.join': 'Entrar no grupo',
	'chat.joining': 'Entrando…',
	'chat.joined': 'Você entrou no grupo',
	'chat.joinFailed': 'Não foi possível entrar no grupo',
	'chat.delivered': 'Recebida',
	'chat.sent': 'Enviada, aguardando entrega',
	'chat.composer': 'Mensagem para {name}',
	'chat.send': 'Enviar mensagem',
	'chat.sendFailed': 'A mensagem não foi enviada. Tente de novo.',
	'chat.participant': 'Participante',
	'chat.pickTitle': 'Escolha uma conversa',
	'chat.pickBody': 'Ou toque em + para adicionar um contato ou criar um grupo.',

	// --- meu código ---
	'share.title': 'Meu código de contato',
	'share.lede': 'Quem ler este código com o IParrot, ou colar o link, envia um pedido de contato para você.',
	'share.qrLabel': 'QR Code do seu contato no IParrot',
	'share.generating': 'Gerando seu código…',
	'share.failed': 'Não foi possível gerar seu código.',
	'share.copyLink': 'Copiar link',
	'share.renew': 'Gerar novo',
	'share.renewHint':
		'“Gerar novo” invalida o código anterior: quem ainda não usou o antigo não consegue mais te adicionar com ele.',

	// --- adicionar contato ---
	'add.title': 'Adicionar contato',
	'add.tabScan': 'Ler o código',
	'add.tabPaste': 'Colar o link',
	'add.scanHint': 'Peça para a pessoa abrir “Meu código de contato” no IParrot dela.',
	'add.linkLabel': 'Link do contato ou do grupo',
	'add.linkPlaceholder': 'Cole aqui o link que a pessoa te mandou (começa com iparrot://)',
	'add.linkHint':
		'Peça para a pessoa abrir “Meu código de contato” e te enviar o link. Links do Berty também funcionam.',
	'add.unknownLink': 'Este link não é de um contato nem de um grupo.',
	'add.parseFailed': 'Não reconheci este link. Confira se ele foi copiado inteiro.',
	'add.groupLabel': 'Convite para um grupo',
	'add.contactLabel': 'Contato do IParrot',
	'add.unnamedGroup': 'Grupo',
	'add.unnamedContact': 'Contato sem nome',
	'add.submitContact': 'Enviar pedido de contato',
	'add.submitGroup': 'Entrar no grupo',
	'add.submitting': 'Enviando…',
	'add.sent': 'Pedido de contato enviado',
	'add.failed': 'Não foi possível concluir. Tente de novo.',
	'add.emptyLink': 'Cole o link antes de enviar.',

	// --- leitor de QR ---
	'scanner.cameraLabel': 'Imagem da câmera',
	'scanner.opening': 'Abrindo a câmera…',
	'scanner.noCamera': 'Sem câmera',
	'scanner.aim': 'Aponte para o QR Code da outra pessoa.',
	'scanner.unsupported': 'Este aparelho não oferece a câmera para a página.',
	'scanner.denied': 'O acesso à câmera foi negado. Libere nas permissões do app, ou escolha uma foto do código.',
	'scanner.failed': 'Não foi possível abrir a câmera. Escolha uma foto do código.',
	'scanner.pickPhoto': 'Escolher uma foto do código',
	'scanner.notFound': 'Não achei um QR Code nessa imagem. Tente uma foto mais próxima e sem reflexo.',
	'scanner.badImage': 'Não consegui abrir essa imagem.',

	// --- grupo ---
	'group.title': 'Criar grupo',
	'group.nameLabel': 'Nome do grupo',
	'group.namePlaceholder': 'Ex.: Família, Equipe da loja',
	'group.inviteWho': 'Quem convidar agora',
	'group.noContacts':
		'Você ainda não tem contatos aceitos. Dá para criar o grupo e convidar depois pelo link.',
	'group.create': 'Criar grupo',
	'group.creating': 'Criando…',
	'group.createFailed': 'Não foi possível criar o grupo.',
	'group.membersCount': '{count} participantes',
	'group.membersOne': '1 participante',
	'group.creator': 'criou o grupo',
	'group.you': '{name} (você)',
	'group.inviteByLink': 'Convidar pelo link',
	'group.inviteWarning':
		'Qualquer pessoa com este link entra no grupo e lê as mensagens. Envie só para quem deve participar.',
	'group.inviteQr': 'QR Code de convite para o grupo {name}',
	'group.copyInvite': 'Copiar link de convite',
	'group.generatingInvite': 'Gerando o convite…',
	'group.inviteFailed': 'Não foi possível gerar o convite.',

	// --- ações da conversa ---
	'actions.unmute': 'Voltar a avisar',
	'actions.unmuteDetail': 'As mensagens novas voltam a aparecer como aviso.',
	'actions.mute': 'Silenciar conversa',
	'actions.muteDetail': 'As mensagens continuam chegando, sem aviso.',
	'actions.muted': '{name} está silenciada',
	'actions.unmuted': '{name} voltou a notificar',
	'actions.muteFailed': 'Não foi possível mudar o aviso desta conversa',
	'actions.members': 'Participantes e convite',
	'actions.membersDetail': 'Ver quem está no grupo e gerar o link de convite.',
	'actions.hide': 'Tirar da lista',
	'actions.hideDetail': 'Some daqui neste aparelho. As mensagens continuam guardadas.',
	'actions.leave': 'Sair do grupo',
	'actions.leaveDetail': 'Você para de receber as mensagens, em todos os seus aparelhos.',
	'actions.block': 'Bloquear {name}',
	'actions.blockDetail': 'Para de receber mensagens e pedidos dessa pessoa.',
	'actions.failed': 'Não foi possível concluir. Tente de novo.',

	'confirm.hide.title': 'Tirar da lista',
	'confirm.hide.body':
		'A conversa some da lista neste aparelho. As mensagens continuam guardadas aqui: o IParrot não apaga o histórico, e dizer que apaga seria mentira. Se a pessoa escrever de novo, a conversa volta.',
	'confirm.hide.confirm': 'Tirar da lista',
	'confirm.hide.done': 'saiu da sua lista',
	'confirm.leave.title': 'Sair do grupo',
	'confirm.leave.body':
		'Você para de receber as mensagens deste grupo, em todos os seus aparelhos. Para voltar, alguém precisa te mandar o link de convite outra vez.',
	'confirm.leave.confirm': 'Sair do grupo',
	'confirm.leave.done': 'você saiu do grupo',
	'confirm.block.title': 'Bloquear contato',
	'confirm.block.body':
		'Essa pessoa para de conseguir te mandar mensagens e pedidos de contato. A conversa sai da sua lista. Dá para desbloquear depois em Configurações.',
	'confirm.block.confirm': 'Bloquear',
	'confirm.block.done': 'foi bloqueado',

	// --- configurações ---
	'settings.title': 'Configurações',
	'settings.yourName': 'Seu nome',
	'settings.saveName': 'Salvar nome',
	'settings.savingName': 'Salvando…',
	'settings.nameSaved': 'Nome salvo',
	'settings.nameFailed': 'Não foi possível salvar o nome',
	'settings.appearance': 'Aparência',
	'settings.themeSystem': 'Sistema',
	'settings.themeLight': 'Claro',
	'settings.themeDark': 'Escuro',
	'settings.language': 'Idioma',
	'settings.blocked': 'Contatos bloqueados',
	'settings.blockedDetail': 'Ver e desbloquear quem você bloqueou',
	'settings.network': 'Rede',
	'settings.networkDetail': 'Aparelhos conectados, endereço deste nó e servidores',
	'settings.backup': 'Backup da conta',
	'settings.backupDetail': 'Guardar sua identidade e suas conversas num arquivo',
	'settings.about': 'Sobre',
	'settings.aboutDetail': 'Versão, licença e inspirações',

	// --- rede ---
	'network.title': 'Rede',
	'network.lede':
		'O IParrot não tem servidor de mensagens. Seu aparelho encontra os dos seus contatos pela rede local, por um ponto de encontro (rendezvous) e, atrás de roteadores, por um relay que só repassa dados criptografados.',
	'network.failed': 'Não foi possível ler o estado da rede.',
	'network.reading': 'Lendo o estado da rede…',
	'network.ownServers': 'Usar meus próprios servidores',
	'network.connected': 'Aparelhos conectados agora',
	'network.peerId': 'Identificador deste nó (Peer ID)',
	'network.listeners': 'Endereços em que este nó escuta',
	'network.noListeners': 'Nenhum no momento',
	'network.connections': 'Conexões',
	'network.active': 'ativa',
	'network.inactive': 'inativa',

	// --- servidores ---
	'servers.title': 'Servidores',
	'servers.lede':
		'O IParrot não tem servidor de mensagens, mas precisa de dois apoios para os aparelhos se acharem: um ponto de encontro (rendezvous) e um relay para quando os dois lados estão atrás de roteador. Nenhum dos dois lê o conteúdo das mensagens, que vai criptografado de ponta a ponta.',
	'servers.lede2':
		'Em branco, o IParrot usa os servidores públicos mantidos pela Berty Technologies. Coloque os seus, um por linha, para não depender deles.',
	'servers.rdvpLabel': 'Pontos de encontro (rendezvous)',
	'servers.relaysLabel': 'Relays',
	'servers.save': 'Salvar servidores',
	'servers.saving': 'Salvando…',
	'servers.saved': 'Salvo. Feche e abra o IParrot para que os novos servidores entrem em uso.',
	'servers.savedToast': 'Servidores salvos. Feche e abra o IParrot para valer.',
	'servers.readFailed': 'Não foi possível ler os servidores.',
	'servers.saveFailed': 'Não foi possível salvar.',

	// --- backup ---
	'backup.title': 'Backup da conta',
	'backup.body':
		'O backup guarda sua identidade e suas conversas num arquivo .tar. É o único jeito de voltar à sua conta se perder este aparelho: não existe servidor com uma cópia, nem recuperação por telefone ou e-mail.',
	'backup.warning':
		'O arquivo não é criptografado. Quem abrir ele vira você no IParrot. Guarde em lugar seguro, de preferência num disco cifrado, e não mande por e-mail nem por aplicativo de mensagem.',
	'backup.warningLead': 'O arquivo não é criptografado.',
	'backup.savedAt': 'Backup salvo em:',
	'backup.run': 'Gerar backup agora',
	'backup.runAgain': 'Gerar outro backup',
	'backup.running': 'Gerando o backup…',
	'backup.failed': 'Não foi possível gerar o backup.',
	'backup.restoreNote':
		'Restaurar o backup ainda não dá para fazer por aqui: o arquivo serve para o IParrot de uma versão futura, e para você não ficar sem saída. Está na lista de pendências do projeto.',

	// --- bloqueados ---
	'blocked.title': 'Contatos bloqueados',
	'blocked.lede':
		'Quem está nesta lista não consegue te mandar mensagem nem pedido de contato. O bloqueio vale para todos os seus aparelhos; a conversa some da lista deste aqui.',
	'blocked.emptyTitle': 'Ninguém bloqueado',
	'blocked.emptyBody': 'Você pode bloquear alguém pelo menu da conversa.',
	'blocked.publicKey': 'Chave pública do contato',
	'blocked.unblock': 'Desbloquear',
	'blocked.unblocked': 'Contato desbloqueado',
	'blocked.unblockFailed': 'Não foi possível desbloquear',
	'blocked.readFailed': 'Não foi possível ler a lista.',

	// --- sobre e inspirações ---
	'about.title': 'Sobre o IParrot',
	'about.version': 'Versão do núcleo: {version}',
	'about.demoSuffix': ' (modo demonstração)',
	'about.body':
		'Mensageiro ponto a ponto, criptografado de ponta a ponta, que funciona sem servidor central. Disponível para Android, iOS, Windows e Linux com o mesmo núcleo.',
	'about.license':
		'O IParrot é um programa proprietário: todos os direitos reservados. Ele é construído sobre projetos abertos, cujas licenças valem e estão aqui na íntegra.',
	'about.developedBy': 'Desenvolvido por',
	'about.licenses': 'Licenças de terceiros',

	'inspirations.title': 'Licenças de terceiros',
	'inspirations.lede':
		'O IParrot se apoia nos projetos abaixo. As licenças deles continuam valendo e estão aqui por inteiro, como elas exigem. Toque em um para ler o papel dele e o texto completo.',
	'inspirations.bundledTitle': 'Código que faz parte do IParrot',
	'inspirations.studiedTitle': 'Projetos estudados, sem código incluído',
	'inspirations.bundledTag': 'faz parte do app',
	'inspirations.studiedTag': 'estudo e referência',
	'inspirations.licenseLabel': 'Licença: {license}',
	'inspirations.what': 'O que é',
	'inspirations.role': 'Papel no IParrot',
	'inspirations.license': 'Licença',
	'inspirations.holder': 'Direitos autorais',
	'inspirations.repo': 'Repositório',
	'inspirations.docsLabel': 'Documentos de licença',
	'inspirations.textFailed': 'Não foi possível abrir o texto desta licença.',
} as const

export type TranslationKey = keyof typeof pt
export type Dictionary = Record<TranslationKey, string>
