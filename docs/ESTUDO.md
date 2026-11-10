# Estudo dos repositórios

Método (emprestado do REA): separar **o que foi lido no código** do **que é inferência**, e registrar onde está a evidência.
Como todos os repositórios do Berty são abertos, não foi preciso engenharia reversa de binários: a leitura direta do
código-fonte dá mais certeza do que qualquer análise de binário.

## morluto/rea
- **O que é**: servidor MCP + CLI para um agente de IA investigar apps (binários nativos, Electron, .NET, sites) com
  Hopper/Ghidra/IDA/Frida. MIT.
- **Uso aqui**: só o método de trabalho. Nenhum código incluído.

## berty/berty (tag v2.472.0)
- **Lido**: `go/pkg/bertymessenger` (serviço e `service_client.go`), `go/pkg/messengertypes` (protobuf, `types.go`),
  `go/internal/initutil`, `go/internal/encryptedrepo`, `go/internal/accountutils`, `go/internal/gorm-sqlcipher`,
  `go/pkg/bertylinks`, `go/framework/bertybridge`, `berty-bridge-expo/Makefile`, temas em `js/packages/assets/themes`.
- **Fatos**:
  - `bertymessenger.NewServiceClient(wesh, opts)` devolve um cliente gRPC em processo — é o que o IParrot usa.
  - A interface recebe o estado por `EventStream` (primeiro o que existe, depois `ListEnded`, depois ao vivo).
  - Mensagem de texto = `Interact` com `AppMessage_UserMessage` serializado.
  - Chaves públicas trafegam em base64 URL-safe sem padding.
  - Builds usam tags `fts5 sqlite sqlite_unlock_notify` e `-ldflags=-checklinkname=0`; Android alinha em 16 KB.
  - O `go.mod` tem `replace` necessários (go-sqlcipher, go-multiaddr para Android SDK 30+, x/mobile) — copiados.
- **Limite encontrado**: `initutil`, `accountutils` e `gorm-sqlcipher` são `internal`. A inicialização foi reescrita
  em `core/node` e o dialeto GORM foi copiado para `core/gormsqlcipher` (MIT).
- **Não trazido**: BLE/Nearby (transportes de proximidade), push, replicação, diretório, bots.

## berty/weshnet (commit exigido pelo Berty v2.472.0)
- **Lido**: `service_client.go`, `service.go` (`Opts`, `applyDefaults`), `pkg/ipfsutil`, `api/protocol/protocoltypes.proto`.
- **Fatos**: `NewServiceClient(Opts)` aceita `IpfsCoreAPI` e `RootDatastore` prontos; sem `TinderService` ele monta
  descoberta local + rendezvous; os endereços padrão de rendezvous e relay são servidores da Berty.
- **Uso**: motor de rede e criptografia. `core/node` segue `NewPersistentServiceClient`, mas com repositório criptografado.

## berty/go-orbit-db e berty/go-ipfs-log
- **O que são**: porta em Go do OrbitDB e do ipfs-log (log CRDT somente-acréscimo sobre IPFS).
- **Uso**: indireto, via weshnet — cada grupo/conversa tem um log de metadados e um de mensagens.

## berty/go-ipfs-repo-encrypted
- **Lido**: `init.go`, `open.go`, `sqlcipher.go`.
- **Uso**: `encrepo.Init/Open` para o repositório IPFS e `NewSQLCipherDatastore` para o datastore raiz.

## berty/gno
- **O que é**: fork do Gno (VM e blockchain de contratos em Go), base de experimentos como o dSocial.
- **Decisão**: fora do IParrot. Um mensageiro não precisa de blockchain, e a licença do gnovm (GNO Network GPL,
  derivada da AGPL) obrigaria a abrir o app inteiro nos mesmos termos.

## berty/uptime
- **O que é**: instância do Upptime (status page via GitHub Actions/Issues/Pages). MIT.
- **Ideia aproveitável**: quando o IParrot tiver rendezvous/relay próprios, monitorá-los do mesmo jeito.

## berty/www.berty.tech
- **O que é**: site em Hugo com a documentação do protocolo. MIT.
- **Uso**: leitura da documentação; referência para um futuro site do IParrot.

## Inferências (não verificadas em execução)
- O núcleo Go não foi compilado nem executado; a correção das chamadas foi conferida contra o código-fonte, não por teste.
- Compatibilidade IParrot ↔ Berty na rede é esperada (mesmo protocolo e formato de link), mas não foi testada.
- O build para Windows depende de kubo/libp2p/SQLCipher compilarem com MinGW; o Berty não publica app Windows.
