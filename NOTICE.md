# Avisos de terceiros

O IParrot usa e se inspira nos projetos abaixo. Os textos integrais das licenças estão em
[`THIRD_PARTY_LICENSES/`](THIRD_PARTY_LICENSES) e dentro do app em **Configurações > Sobre > Inspirações**.

## Código que faz parte do aplicativo

| Projeto | Como entra | Licença | Titular |
| --- | --- | --- | --- |
| [berty/berty](https://github.com/berty/berty) | Dependência Go: `bertymessenger`, `messengertypes` | Apache-2.0 ou MIT | © 2018–2023 Berty Technologies e colaboradores |
| [berty/weshnet](https://github.com/berty/weshnet) | Dependência Go: protocolo Wesh | Apache-2.0 ou MIT | © 2018–2023 Berty Technologies e colaboradores |
| [berty/go-orbit-db](https://github.com/berty/go-orbit-db) | Dependência Go (via weshnet) | Apache-2.0 | Berty Technologies; portado do OrbitDB (MIT) |
| [berty/go-ipfs-log](https://github.com/berty/go-ipfs-log) | Dependência Go (via go-orbit-db) | Apache-2.0 | Berty Technologies; portado do ipfs-log (MIT) |
| [berty/go-ipfs-repo-encrypted](https://github.com/berty/go-ipfs-repo-encrypted) | Dependência Go: repositório IPFS em SQLCipher | Apache-2.0 ou MIT | © 2020 Berty Technologies e colaboradores |
| GORM SQLite driver (variante SQLCipher do Berty) | **Código copiado** em `core/gormsqlcipher/` | MIT | © 2013–presente Jinzhu |

Trechos adaptados do Berty (Apache-2.0/MIT) estão identificados nos comentários de `core/node/node.go`
(`loadEncryptedRepo`, `persistentConfig`, `openMessengerDB`).

O binário final também inclui as dependências transitivas desses módulos (kubo/IPFS, go-libp2p, gRPC, GORM, zap,
SQLCipher e outras) e, na interface, React, Zustand, Lucide, qrcode-generator, Capacitor e a fonte Nunito (SIL OFL 1.1).
Antes de distribuir em loja, gere o inventário completo com `go-licenses report ./...` e `npx license-checker --production`
(ver docs/BUILD.md).

## Projetos estudados, sem código incluído

| Projeto | Papel | Licença |
| --- | --- | --- |
| [morluto/rea](https://github.com/morluto/rea) | Método de estudo (observação, evidência, inferência) | MIT, © 2026 morluto |
| [berty/gno](https://github.com/berty/gno) | Referência de apps descentralizados | gnovm e gno.land: GNO Network GPL 3.0 (copyleft); tm2: Apache-2.0 |
| [berty/uptime](https://github.com/berty/uptime) | Referência para página de status | MIT, © 2020 Anand Chowdhary |
| [berty/www.berty.tech](https://github.com/berty/www.berty.tech) | Documentação do protocolo; referência de site | MIT, © 2018–2020 Berty Technologies |

O código do Gno **não** foi incorporado de propósito: a licença do gnovm/gno.land é copyleft forte (derivada da AGPL)
e obrigaria a distribuir o IParrot inteiro nos mesmos termos.

## Marcas

"Berty" e "Wesh" são nomes dos respectivos projetos e não são usados como marca do IParrot. O IParrot é um projeto
independente, não afiliado nem endossado pela Berty Technologies.
