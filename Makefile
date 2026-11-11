# IParrot — comandos de build.
#
# Requisitos: Go (versão do go.mod), Node 20+, compilador C (CGO é obrigatório por causa do SQLCipher).
#   Desktop: Wails v2 (`make tools`) e, no Linux, libgtk-3-dev + libwebkit2gtk-4.1-dev
#   Android: JDK 21 para o Gradle e JDK 17 para o gomobile (ver JAVA_HOME_GOMOBILE abaixo), Android SDK + NDK
#   iOS:     macOS com Xcode e CocoaPods

GO          ?= go
# Mesmas tags e ldflags usadas pelo Berty: FTS5 para a busca e -checklinkname=0 para dependências que usam linkname.
GO_TAGS     ?= fts5 sqlite sqlite_unlock_notify
# Nos builds móveis entra também `noproximitytransport`, que desliga os drivers
# BLE e Multipeer Connectivity do weshnet. O IParrot não usa transporte de
# proximidade (está no roadmap), e no iOS esses drivers exigem o CoreBluetooth
# linkado no projeto Xcode — sem ele, o link falha com símbolos indefinidos.
GO_LDFLAGS  ?= -checklinkname=0
WAILS       ?= wails
# Deve acompanhar a versão de github.com/wailsapp/wails/v2 no go.mod.
WAILS_VERSION ?= v2.17.1
GOMOBILE    ?= $(GO) run golang.org/x/mobile/cmd/gomobile
ANDROID_API ?= 23
# O gomobile gera o .aar chamando `javac -source 1.7`, que o JDK 21 recusa; já
# o Gradle do Capacitor (AGP 8.7) exige o 21. Quando as duas versões estiverem
# instaladas, aponte esta variável para a 17 e só o `bind` a usará:
#   make android JAVA_HOME_GOMOBILE=/caminho/do/jdk-17
#
# O PATH entra junto de propósito: o gomobile invoca `javac` pelo PATH, não
# pelo JAVA_HOME, então mexer só na variável não troca o compilador.
JAVA_HOME_GOMOBILE ?=
GOMOBILE_JAVA = $(if $(JAVA_HOME_GOMOBILE),env JAVA_HOME="$(JAVA_HOME_GOMOBILE)" PATH="$(JAVA_HOME_GOMOBILE)/bin:$(PATH)",)
# Só arm64: é o que todo celular Android usa hoje. O amd64 serve a emulador e
# Chromebook, e cada arquitetura a mais soma ~100 MB ao APK, porque o nó IPFS
# inteiro vai compilado dentro. Para rodar em emulador x86:
#   make android ANDROID_TARGET=android/arm64,android/amd64
ANDROID_TARGET ?= android/arm64
IOS_TARGET  ?= ios,iossimulator

.PHONY: help tools deps test conferir-tags conferir-licencas conferir ci ui daemon run desktop-linux desktop-windows android-core android ios-core ios clean

help:
	@echo "make tools            instala a CLI do Wails (builds desktop)"
	@echo "make deps             resolve dependências Go (gera go.sum)"
	@echo "make test             roda os testes do núcleo"
	@echo "make conferir         confere restrições de build e licenças (não compila)"
	@echo "make ci               tudo que a CI confere, sem precisar da CI"
	@echo "make ui               compila a interface (ui/dist)"
	@echo "make run              sobe o núcleo + interface no navegador (iparrotd)"
	@echo "make desktop-linux    app desktop para Linux      -> build/bin/iparrot"
	@echo "make desktop-windows  app desktop para Windows    -> build/bin/IParrot.exe (rodar no Windows)"
	@echo "make android          APK de depuração            -> mobile/android/app/build/outputs/apk/debug/"
	@echo "make ios              build para o simulador iOS  (rodar no macOS)"
	@echo
	@echo "Em servidor que já roda outras coisas, compile em container, sem instalar"
	@echo "nada no host: ./build/docker/iparrot.sh (ver build/docker/README.md)"

tools:
	$(GO) install github.com/wailsapp/wails/v2/cmd/wails@$(WAILS_VERSION)

deps:
	$(GO) mod tidy

test:
	$(GO) test -tags "$(GO_TAGS)" ./core/... ./ui/...

# Confere, sem compilar, que exatamente um arquivo do cofre de chaves vale
# para cada um dos onze alvos. Esse erro já custou duas execuções inteiras de
# CI (no iOS, porque GOOS=ios satisfaz também a tag `darwin`) e aqui sai em
# menos de um segundo, antes dos jobs lentos.
conferir-tags:
	python3 scripts/conferir-tags.py --autoteste
	python3 scripts/conferir-tags.py

# Confere que as obrigações de licença de terceiros seguem íntegras: as duas
# cópias dos textos (a que acompanha os binários e a que o app mostra em
# Inspirações) e o NOTICE.md. Fechar o código do IParrot não dispensa nada
# disso — Apache-2.0 e MIT exigem que os avisos acompanhem a distribuição.
conferir-licencas:
	python3 scripts/conferir-licencas.py

conferir: conferir-tags conferir-licencas

# O que a CI confere, rodando na sua máquina — útil quando os minutos do
# Actions acabam (ver docs/BUILD.md, "Quando os minutos do Actions acabam").
# `test` e `deps` exigem rede para os módulos Go; `conferir` e `ui` não.
ci: conferir ui test

ui:
	cd ui && npm ci && npm run build

daemon: ui
	$(GO) build -tags "$(GO_TAGS)" -ldflags "$(GO_LDFLAGS)" -o build/bin/iparrotd ./cmd/iparrotd

run: daemon
	./build/bin/iparrotd

desktop-linux: ui
	$(WAILS) build -s -skipbindings -platform linux/amd64 -tags "$(GO_TAGS) webkit2_41" -ldflags "$(GO_LDFLAGS)" -o iparrot

desktop-windows: ui
	$(WAILS) build -s -skipbindings -platform windows/amd64 -tags "$(GO_TAGS)" -ldflags "$(GO_LDFLAGS)" -webview2 embed -o IParrot.exe

android-core:
	$(GO) install golang.org/x/mobile/cmd/gobind
	$(GOMOBILE) init
	mkdir -p mobile/android/app/libs
	$(GOMOBILE_JAVA) $(GOMOBILE) bind -v \
		-ldflags "$(GO_LDFLAGS) -s -w -extldflags=-Wl,-z,max-page-size=16384" \
		-tags "$(GO_TAGS) noproximitytransport" \
		-target $(ANDROID_TARGET) -androidapi $(ANDROID_API) \
		-o mobile/android/app/libs/iparrotcore.aar \
		./core/iparrotcore

android: ui android-core
	cd mobile && npm ci && npx cap sync android
	cd mobile/android && ./gradlew assembleDebug

ios-core:
	$(GO) install golang.org/x/mobile/cmd/gobind
	$(GOMOBILE) init
	CGO_CPPFLAGS=-DHAVE_GETHOSTUUID=0 $(GOMOBILE) bind -v \
		-ldflags "$(GO_LDFLAGS) -s -w" \
		-tags "$(GO_TAGS) nowatchdog noproximitytransport" \
		-target $(IOS_TARGET) -iosversion 14.0 \
		-o mobile/ios/IParrotCore/Iparrotcore.xcframework \
		./core/iparrotcore

ios: ui ios-core
	cd mobile && npm ci && npx cap sync ios
	cd mobile/ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
		-sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build

clean:
	rm -rf build/bin ui/dist ui/dist-single mobile/android/app/libs/*.aar mobile/ios/IParrotCore/Iparrotcore.xcframework
