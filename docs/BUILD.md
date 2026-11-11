# Como compilar

CGO é obrigatório em todas as plataformas (SQLCipher). Use sempre as tags `fts5 sqlite sqlite_unlock_notify` e
`-ldflags=-checklinkname=0` — o `Makefile` já faz isso.

## Em servidor que já roda outras coisas

Se a máquina onde você vai compilar já serve algo em produção, **não instale o
toolchain nela**: o `libwebkit2gtk-4.1-dev` sozinho arrasta dezenas de pacotes
no sistema inteiro. Use a bancada em container, que não deixa rastro no host:

```bash
./build/docker/iparrot.sh imagem
./build/docker/iparrot.sh deps
./build/docker/iparrot.sh build
```

Detalhes, testes com dois nós e como apagar tudo: [build/docker/README.md](../build/docker/README.md).

## Primeira vez

```bash
make deps      # go mod tidy: resolve ~400 módulos e cria o go.sum
git add go.mod go.sum && git commit -m "deps: go.sum"
```

Se o `go mod tidy` reclamar de versão, é sinal de conflito entre as dependências do Berty e as do Wails; a regra é
manter as versões do `go.mod` do Berty v2.472.0.

## Linux

```bash
sudo apt install build-essential libgtk-3-dev libwebkit2gtk-4.1-dev
make tools desktop-linux      # build/bin/iparrot
make daemon                   # build/bin/iparrotd (sem janela)
```

## Windows (.exe)

Instale Go, Node e um GCC MinGW-w64 (por exemplo via MSYS2 ou `choco install mingw`). Depois, no Git Bash:

```bash
go mod tidy
go install github.com/wailsapp/wails/v2/cmd/wails@v2.17.1
(cd ui && npm ci && npm run build)
wails build -s -skipbindings -platform windows/amd64 -tags "fts5 sqlite sqlite_unlock_notify" -ldflags "-checklinkname=0" -webview2 embed -o IParrot.exe
```

Para um instalador, acrescente `-nsis` (requer NSIS instalado).

## Android

Android SDK e NDK (`ANDROID_HOME` e `ANDROID_NDK_HOME` definidos) e **dois JDKs**, porque as duas ferramentas da
cadeia discordam:

- o **gomobile** gera o `.aar` chamando `javac -source 1.7`, que do JDK 21 em diante é erro
  (`Source option 7 is no longer supported`) — o Berty fixa o 17 pelo mesmo motivo;
- o **Gradle** do Capacitor (AGP 8.7) exige o 21 (`invalid source release: 21` se for menor).

Deixe o 21 como JDK padrão e aponte a variável para o 17, que será usada só no `bind` — o Makefile coloca esse JDK
à frente do `PATH` nesse passo, porque o gomobile procura o `javac` ali e não no `JAVA_HOME`:

```bash
make android JAVA_HOME_GOMOBILE=/usr/lib/jvm/temurin-17-jdk-amd64
# saída: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

O APK sai só para `arm64`, que é o que os celulares usam. Para rodar em emulador x86:

```bash
make android ANDROID_TARGET=android/arm64,android/amd64 JAVA_HOME_GOMOBILE=...
```

Cada arquitetura soma cerca de 100 MB, porque o nó IPFS inteiro vai compilado dentro do `.so`.

### Assinar para a Play Store

O keystore do Android é auto-assinado e você mesmo gera — não é certificado de autoridade certificadora e não se
compra:

```bash
keytool -genkeypair -v -keystore iparrot-release.jks \
  -alias iparrot -keyalg RSA -keysize 4096 -validity 10000
```

**Guarde esse arquivo e a senha como você guarda um certificado A1.** Perdido o keystore, não existe mais como
publicar atualização do mesmo app na Play Store, a não ser que o Play App Signing esteja ativado.

Com ele em mãos, configure `signingConfigs` em `mobile/android/app/build.gradle` e gere o pacote da loja:

```bash
cd mobile/android && ./gradlew bundleRelease
```

O `.aab` entrega a cada aparelho só a fatia da arquitetura dele, então o download fica bem menor que o APK.

Para a Play Store: crie um keystore, configure `signingConfigs` em `mobile/android/app/build.gradle` e use
`./gradlew bundleRelease`.

## iOS

Só em macOS, com Xcode e CocoaPods.

```bash
make ios                      # compila para o simulador, sem assinatura
cd mobile && npx cap open ios # abre no Xcode para rodar em aparelho
```

### iOS: assinatura e TestFlight

É preciso uma conta Apple Developer. No Xcode, escolha o Team em *Signing & Capabilities* e troque o bundle id
`app.iparrot.messenger` se necessário. Para automatizar na CI, adicione os segredos do certificado e do perfil e um passo
`xcodebuild archive` + `-exportArchive`.

## Publicar uma versão

Os binários vão para o Releases, não para os artefatos da execução: anexo de release não entra na cota de
armazenamento do Actions, que no plano Free é de 500 MB e enche rápido (cada execução produz ~242 MB).

```bash
git tag v0.1.0
git push origin v0.1.0
```

Sem poder empurrar tags, há o caminho equivalente pela interface: **Actions → Build IParrot → Run workflow**, com a
versão no campo `versao` (ex.: `v0.1.0`). O `gh release create` cria a tag junto com o release.

Qualquer um dos dois dispara os cinco jobs e, no fim, o job `release` junta os binários, gera o `SHA256SUMS.txt` e publica com as
notas de `.github/RELEASE_NOTES.md`. Os artefatos de execução continuam existindo para depuração, mas com retenção de
7 dias.

O job do iOS roda só em tag ou sob demanda (**Actions → Build IParrot → Run workflow**): é o mais lento e não produz
nada instalável.

## Variáveis de ambiente do núcleo

| Variável | Efeito |
| --- | --- |
| `IPARROT_RDVP` | Lista (vírgulas) de multiaddrs de rendezvous próprios |
| `IPARROT_RELAYS` | Lista (vírgulas) de multiaddrs de relays próprios |
| `IPARROT_DATA_DIR` | Pasta de dados do app desktop |
| `IPARROT_TOKEN` | Token fixo do `iparrotd` (desenvolvimento) |

## Desenvolvimento da interface contra um núcleo real

```bash
./build/bin/iparrotd -no-ui -token dev -listen 127.0.0.1:7788
cd ui && VITE_CORE_URL=http://127.0.0.1:7788 VITE_CORE_TOKEN=dev npm run dev
```

## Inventário de licenças para distribuição

```bash
go install github.com/google/go-licenses@latest && go-licenses report ./... > THIRD_PARTY_LICENSES/go-modules.csv
(cd ui && npx license-checker --production --csv > ../THIRD_PARTY_LICENSES/npm-packages.csv)
```
