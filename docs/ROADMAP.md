# Próximos passos

## Feito nesta rodada

- [x] Silenciar conversa, tirar da lista, sair do grupo, bloquear e desbloquear contato.
- [x] Ler o QR Code de contato pela câmera (BarcodeDetector com jsQR de reserva) ou por uma foto.
- [x] Android: serviço em primeiro plano para o nó não cair, e aviso de mensagem nova.
- [x] Desktop: chave de armazenamento no cofre do sistema (DPAPI, Keychain, Secret Service).
- [x] Servidores de encontro e relay próprios, configuráveis dentro do app.
- [x] Backup da conta num arquivo `.tar`.
- [x] Português, inglês e espanhol, com troca dentro do app.

## Para a v0.1 funcionar de ponta a ponta

- [ ] Rodar `make deps` com Go 1.26.5+, fazer commit do `go.sum` e corrigir o que o compilador apontar no núcleo Go.
- [ ] Testar duas instâncias (`iparrotd` com `-dir` diferentes) trocando pedido de contato e mensagens.
- [ ] Testar IParrot ↔ Berty (compatibilidade de link e de protocolo).
- [ ] Validar o build Windows (kubo + libp2p + SQLCipher com MinGW).
- [ ] Validar Android em aparelho real com API 30+ (interfaces de rede) e iOS em aparelho.
- [ ] Conferir o serviço em primeiro plano no Android 14 e 15 (as regras de `dataSync` mudaram).

## Infraestrutura própria

- [x] Rendezvous e relay próprios: `server/rdvp/` tem o Dockerfile e o compose prontos (o `rdvp` do Berty faz as duas funções num processo só). Falta rodar numa máquina com IP público e apontar o app para ele.
- [ ] Página de status no modelo do Upptime.
- [ ] Servidor de replicação para entregar mensagens com o destinatário offline. O Berty já traz um: `berty repl-server`
      (`go/cmd/berty/replication.go` + `go/pkg/bertyreplication`), e a API do messenger já tem
      `ReplicationServiceRegisterGroup`. Falta: subir o servidor (ele exige o fluxo de autenticação por token do Berty,
      bem mais trabalhoso que o `rdvp`) e expor o registro de grupo na API do IParrot, que hoje não o publica.
      É este servidor — não o relay — que faria o papel de "guarda enquanto você está offline", como um relay do Nostr.

## App

- [ ] Restaurar o backup (hoje só exporta). Precisa de um fluxo de "trocar de conta" e de validação do arquivo.
- [ ] Criptografar o backup com uma senha escolhida pelo usuário.
- [ ] iOS: notificações push (o Berty usa uma extensão de notificação com um segundo framework Go).
- [ ] Transportes de proximidade (Bluetooth LE, Nearby/Multipeer). Os drivers existem no weshnet, mas os builds móveis
      passam `noproximitytransport` para desligá-los: no iOS eles exigem o CoreBluetooth linkado no projeto Xcode mais
      as permissões de Bluetooth no Info.plist, e no Android as classes Java do driver. Para ligar, tire a tag do
      Makefile e acrescente essas peças nativas.
- [ ] Apagar mensagens de verdade (o Berty não tem; exigiria mexer no banco do messenger).
- [ ] Anexos: foto, áudio e arquivo. O protocolo suporta; falta a interface e o cuidado com o tamanho.
- [ ] Testes de ponta a ponta da interface (Playwright) no fluxo de adicionar contato e conversar.
- [ ] Testes do `core/api` com um cliente de mensagens falso — só dá para escrever depois que o módulo compilar.
