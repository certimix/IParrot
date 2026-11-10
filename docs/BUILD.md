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

Deixe o 21 como JDK padrão e aponte a variável para o 17, que será usada só no `bind`:

```bash
make android JAVA_HOME_GOMOBILE=/usr/lib/jvm/temurin-17-jdk-amd64
# saída: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

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
