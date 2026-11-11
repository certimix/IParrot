# Arquitetura do IParrot

## Decisão central

O Berty separa o app em um **núcleo Go** (protocolo + mensageiro) e uma **interface** que conversa com ele por uma
ponte. O IParrot mantém essa separação e troca duas coisas:

| | Berty | IParrot | Por quê |
| --- | --- | --- | --- |
| Interface | React Native (Expo), só Android/iOS | React + Vite em WebView | O Berty não tem app gráfico para Windows/Linux. Uma interface web roda igual nas quatro plataformas. |
| Ponte | gRPC sobre ponte nativa (`bertybridge`) | HTTP local em 127.0.0.1 + token | Uma única ponte serve Wails, Capacitor e navegador; dá para depurar com `curl`. |
| Núcleo | `initutil` (interno) monta tudo | `core/node` monta com as APIs públicas | Os pacotes `internal` do Berty não podem ser importados de fora. |

O que **não** muda: protocolo Wesh, formato dos links, camada de mensagens (`bertymessenger`) e armazenamento
criptografado. Por isso IParrot e Berty são compatíveis na rede.

## Camadas

1. **`core/node`** — sobe, nesta ordem:
   1. repositório IPFS em SQLCipher (`go-ipfs-repo-encrypted`), arquivo `ipfs.sqlite`;
   2. nó IPFS/libp2p em processo (`weshnet/pkg/ipfsutil`), com relay e rendezvous;
   3. datastore raiz do Wesh, também SQLCipher (`datastore.sqlite`): chaves de grupos e cache do OrbitDB;
   4. serviço Wesh (`weshnet.NewServiceClient`): identidade, contatos, grupos, E2EE sobre `go-orbit-db`/`go-ipfs-log`;
   5. banco do mensageiro (`messenger.sqlite`, GORM + SQLCipher) e `bertymessenger.NewServiceClient`.
2. **`core/api`** — servidor HTTP que traduz a API gRPC do mensageiro para JSON simples e um fluxo de eventos (SSE).
   O contrato está em `core/api/types.go` e `ui/src/core/types.ts`.
3. **`core/runtime`** — liga/desliga (nó + servidor) usado por todos os empacotamentos.
4. **Empacotamentos**
   - `main.go`: app desktop com Wails; a interface pergunta URL e token ao Go (`App.CoreInfo`).
   - `core/iparrotcore`: entrada gomobile; os plugins nativos em `mobile/` chamam `StartWithKey`.
   - `cmd/iparrotd`: sem janela; serve a interface no navegador.

## API local

Todas as rotas exigem `Authorization: Bearer <token>`; o token é aleatório a cada inicialização.

| Rota | O que faz |
| --- | --- |
| `GET /api/v1/events?history=30` | Fluxo SSE: estado atual, `listEnded`, depois tudo ao vivo |
| `GET/POST /api/v1/account` | Ler / trocar o nome |
| `GET /api/v1/share` | Link de contato (`iparrot://…`), base do QR |
| `POST /api/v1/links/parse` | Dizer se um link é de contato ou de grupo |
| `POST /api/v1/contacts/request`, `/accept` | Pedir / aceitar contato |
| `POST /api/v1/groups`, `/groups/join`, `/groups/link` | Criar grupo, entrar, gerar convite |
| `POST /api/v1/conversations/open`, `/close`, `/load` | Marcar como aberta (zera não lidas), carregar histórico |
| `POST /api/v1/conversations/mute` | Silenciar ou voltar a avisar |
| `POST /api/v1/conversations/hide` | Tirar a conversa da lista deste aparelho |
| `POST /api/v1/groups/leave` | Sair do grupo (protocolo) e escondê-lo aqui |
| `POST /api/v1/contacts/block` | Bloquear / desbloquear contato |
| `GET /api/v1/blocked` | Lista de contatos bloqueados |
| `POST /api/v1/messages` | Enviar texto |
| `GET /api/v1/search?q=` | Buscar nas mensagens |
| `GET /api/v1/network` | Peer ID, endereços, pares conectados |
| `GET/POST /api/v1/servers` | Ler / gravar rendezvous e relays próprios |
| `POST /api/v1/export` | Gravar o backup da conta e devolver o caminho |

Proteções: escuta só em loopback, recusa `Host` que não seja loopback (DNS rebinding), token comparado em tempo
constante, corpo limitado a 1 MiB.

## Links

O Berty gera `BERTY://PB/…` (interno, bom para QR) e `https://berty.tech/id#…` (web). O IParrot mostra o interno com o
prefixo `IPARROT://` e aceita os três formatos; a troca de prefixo é feita em `core/api/types.go`.

## Estado local (`local.json`)

A camada de mensagens do Berty não acompanha os eventos `AccountContactBlocked` e `AccountGroupLeft` do protocolo: se o
IParrot só chamasse o protocolo, o banco dele continuaria listando a conversa. Por isso o IParrot faz as duas coisas —
chama o protocolo (a ação vale para todos os aparelhos) e guarda em `local.json` o que deve sumir desta instalação.
`core/api/server.go:visible()` aplica esse filtro antes de cada evento chegar à interface.

O mesmo arquivo guarda os servidores próprios (`rdvp`, `relays`), lidos ao subir o nó. Ele fica em texto puro, fora do
banco criptografado, e por isso só contém chaves públicas, que já circulam pela rede.

**Lista vazia não é "sem servidor".** Quando `P2PRdvpMaddrs` chega `nil`, o weshnet cai para os servidores públicos do
Berty — em `service.go` (`opts.P2PRdvpMaddrs == nil` → `ipfsutil.DefaultP2PRdvpMaddr`) e em `pkg/ipfsutil/mobile.go`
(idem para `PeerStorePeers` e `P2PStaticRelays`). Ou seja, de fábrica o IParrot depende da infraestrutura da Berty
Technologies, hoje em `51.15.25.224`. `Node.EffectiveRdvp`, `Node.EffectiveRelays` e `Node.UsingDefaultServers`
registram o que de fato vale, e a tela **Configurações → Rede → Usar meus próprios servidores** mostra esses endereços:
sem isso a tela aparece vazia e dá a impressão de que não há servidor nenhum, o que torna qualquer problema de conexão
impossível de diagnosticar. Para não depender de terceiros, suba o `server/rdvp/` e configure os endereços nessa tela.

## Chave de armazenamento

Os três bancos usam a mesma chave de 32 bytes e sais distintos. A chave vem, nesta ordem:

1. **Android**: aleatória, cifrada por uma chave AES-GCM do Android Keystore (`IParrotCorePlugin.java`).
   **iOS**: aleatória, no Keychain com `AfterFirstUnlockThisDeviceOnly` (`AppDelegate.swift`).
2. **Desktop**: cofre do sistema, sem dependência externa (`core/node/vault_*.go`) — DPAPI via `crypt32.dll` no Windows,
   Keychain pelo utilitário `security` no macOS, Secret Service pelo `secret-tool` no Linux.
3. **Sem cofre** (servidor sem sessão gráfica, libsecret ausente): `keys.json` com permissão 0600, e um aviso no log.

Quando a chave já nasceu no cofre e ele depois some, o nó recusa subir em vez de gerar outra chave — subir com chave nova
tornaria os bancos existentes ilegíveis. Os sais ficam sempre em `keys.json`: são públicos por natureza, pois moram no
cabeçalho em texto plano do SQLCipher.

## Cores

`ui/src/styles.css` usa os mesmos papéis de cor do tema padrão do Berty (`default-theme.json` e `DarkLF-theme.json`),
trocando apenas o azul de cabeçalho pelo azul da logo:

| Papel | Berty | IParrot |
| --- | --- | --- |
| Cor predominante (cabeçalhos, botões, balão enviado) | `#535AE4` | **`#2D3691`** (logo) |
| Links, foco, balão enviado no tema escuro | — | `#535AE4` |
| Destaque / avisos / não lidas | `#F64278` | `#F64278` |
| Texto | `#383B62` | `#383B62` |
| Fundo de campos | `#F7F8FF` | `#F7F8FF` |
| Apoio claro | `#CED2FF` | `#CED2FF` |
| Apoio neutro | `#A5A7C5` | `#A5A7C5` |
| Fundo escuro | `#2B2E4D` | `#2B2E4D` |

## Idiomas

`ui/src/i18n/` tem um dicionário por idioma: português (fonte), inglês e espanhol. `pt.ts` define o tipo `Dictionary`, e
os outros dois o implementam — esquecer uma chave não compila. O idioma inicial vem de `navigator.languages` e a escolha
do usuário fica em `localStorage`. `useT()` é o hook; `translate()` serve fora de componentes, como em `lib/format.ts`,
que troca os formatadores de data junto com o idioma.
