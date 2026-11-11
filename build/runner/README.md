# Runner próprio do GitHub Actions

Compila o IParrot na sua máquina, coordenado pelo GitHub, **sem gastar minuto
de Actions**.

## Por que

Em repositório **privado**, o plano Free do GitHub dá 2.000 minutos de Actions
por mês. Quando acabam, os jobs deixam de iniciar. A falha é enganosa:

```
Build IParrot / Interface (typecheck + build)   Failing after 2s
```

Dois segundos, nenhum passo executado, log indisponível. A causa só aparece
nas anotações do job:

> The job was not started because an Actions budget is preventing further use.

Não é erro de código, de lockfile nem de cota de armazenamento de artefatos.
É cobrança. Um runner próprio não consome minuto: o GitHub distribui o
trabalho, a sua máquina executa.

Alternativas, para comparar antes de montar isto:

| caminho | custo | prazo | observação |
|---|---|---|---|
| Deixar o repositório público | grátis | imediato | minutos ilimitados, mas o código fica legível por qualquer um |
| Esperar o ciclo virar | grátis | até o dia 1º | os minutos voltam no início do ciclo de cobrança |
| Liberar gasto no GitHub | US$ 0,008/min Linux | imediato | alguns centavos por build |
| **Runner próprio (esta pasta)** | energia da máquina | ~40 min de montagem | ilimitado, privado, seu |

## Isolamento

O projeto tem uma regra inviolável: nada novo no servidor pode se misturar com
o que já roda lá. Este runner a respeita por construção.

Tudo nomeado com prefixo próprio:

| | |
|---|---|
| container | `iparrot-runner` |
| rede | `iparrot-runner-rede` |
| volumes | `iparrot-runner-runtime`, `iparrot-runner-cache` |

E o que deliberadamente **não** existe aqui:

- **Nenhuma porta publicada.** O runner abre uma conexão de saída para o
  GitHub e espera trabalho. Ninguém liga para ele, então não há superfície
  nova exposta no servidor.
- **Nenhum bind mount do host.** Ele não enxerga pasta sua nenhuma. O código
  vem do `git clone` que ele mesmo faz, dentro do volume.
- **Nenhum `/var/run/docker.sock`.** Container com o socket do Docker manda no
  servidor inteiro — é o oposto de isolar.
- **Sem `privileged`, com `no-new-privileges` e `cap_drop: ALL`**, para que um
  script de build não consiga escalar privilégio.
- **Teto de CPU e memória.** Um build pesado não pode roubar recurso do que
  está em produção. Ajuste em `RUNNER_CPUS` e `RUNNER_MEM`.

Nada é instalado no host: Go, os dois JDKs, o Android SDK, o NDK e o Node
vivem dentro da imagem.

## Antes de começar

**Memória é o requisito que derruba.** O núcleo do IParrot arrasta a árvore do
IPFS/libp2p e o compilador Go chega a pedir perto de 4 GB. Com `RUNNER_MEM`
abaixo de `4g` o build morre por falta de memória, e apertar o teto para caber
num servidor sem folga só transfere o problema para a produção. Confira:

```bash
free -g
```

Se não houver uns 6 GB livres com folga, compile em outra máquina — um desktop
serve — em vez de apertar aqui.

Disco: a imagem sai com cerca de 8 GB (o NDK sozinho passa de 2 GB) e os
caches crescem alguns GB.

## Montagem

```bash
cd build/runner
cp .env.exemplo .env
nano .env            # preencha REPO e GH_PAT
chmod 600 .env

docker compose up -d --build
docker compose logs -f
```

A primeira construção baixa SDK, NDK e JDKs: conte uns 20 a 40 minutos.

Quando terminar, o runner aparece como **Idle** em
`Settings > Actions > Runners`.

### O token

Prefira um token **fine-grained**, com permissão só neste repositório:

1. https://github.com/settings/personal-access-tokens/new
2. *Repository access* → **Only select repositories** → `certimix/IParrot`
3. *Permissions* → **Administration: Read and write** — só essa
4. *Expiration* → 90 dias, e anote para renovar

Cole em `GH_PAT` no `.env`. Com ele o container cria o próprio token de
registro a cada partida, então aguenta reinício do servidor sem você mexer.

O `.env` está no `.gitignore`. **Token não se cola em conversa, mensagem nem
commit** — colado, deixa de ser secreto na hora e tem de ser revogado em
https://github.com/settings/tokens.

Se preferir não criar PAT, use `RUNNER_TOKEN` com o valor que aparece em
*Settings > Actions > Runners > New self-hosted runner*. Vale uma hora e serve
para o primeiro registro; depois a credencial fica no volume.

## Ligar o workflow nele

O workflow não muda de arquivo: ele lê uma variável do repositório.

1. `Settings > Secrets and variables > Actions > Variables > New variable`
2. Nome: `RUNNER_UBUNTU`
3. Valor: `iparrot-vps` (a mesma etiqueta de `RUNNER_LABELS` no `.env`)

A partir daí os jobs **Interface**, **Linux**, **Android** e **Publicar
release** rodam no seu runner. Apagando a variável, tudo volta para os runners
do GitHub sem editar nada.

Dois jobs continuam no GitHub porque exigem outro sistema operacional:

| job | onde |
|---|---|
| **Windows (.exe)** | `windows-latest`, no GitHub |
| **iOS** | `macos-latest`, no GitHub, e só sob demanda |

O Android era o job mais longo, então mesmo levando só os jobs Linux para cá,
os minutos que sobram no GitHub passam a durar bem mais.

## Operação

```bash
docker compose logs -f           # acompanhar
docker compose ps                # estado
docker compose restart           # reiniciar
docker compose down              # parar e tirar da lista de runners
docker compose down -v           # idem, apagando caches e credencial
docker stats iparrot-runner      # conferir se o teto está sendo respeitado
```

Ao parar pelo `down`, o container se desregistra do repositório em vez de
ficar pendurado como offline — isso depende do `GH_PAT`.

## Quando algo falha

**O runner não aparece em Settings > Actions > Runners.**
`docker compose logs` mostra a recusa. Quase sempre é o `GH_PAT` sem
*Administration: Read and write*, ou expirado.

**Job fica em `Queued` para sempre.**
A etiqueta não casa. O valor de `RUNNER_UBUNTU` no repositório tem de ser
idêntico a `RUNNER_LABELS` no `.env`.

**Build morre sem mensagem clara, ou o log para no meio do compilador Go.**
Falta de memória. Suba `RUNNER_MEM` ou compile em máquina com mais folga.
`docker inspect iparrot-runner --format '{{.State.OOMKilled}}'` confirma.

**O zip das command-line tools dá 404.**
O número do build mudou. Pegue o atual em
https://developer.android.com/studio#command-line-tools-only e reconstrua:

```bash
docker compose build --build-arg CMDLINE_TOOLS_ZIP=commandlinetools-linux-XXXXXXXX_latest.zip
```

**Algum passo falha por permissão.**
O `cap_drop: ALL` é conservador. Comente as duas linhas de `cap_drop` no
`docker-compose.yml`, reconstrua e veja se resolve.

## Segurança

Runner próprio em repositório **privado** é seguro: só quem tem acesso ao
repositório consegue fazer código rodar nele.

Se algum dia o IParrot virar público, **tire este runner antes**. Em
repositório público, qualquer pessoa abre um pull request e o workflow
executaria o código dela na sua máquina. É recomendação do próprio GitHub, e
vale mesmo com o container isolado como está aqui.
