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
ANDROID_TARGET ?= android/arm64,android/amd64
IOS_TARGET  ?= ios,iossimulator

.PHONY: help tools deps test ui daemon run desktop-linux desktop-windows android-core android ios-core ios clean

help:
	@echo "make tools            instala a CLI do Wails (builds desktop)"
	@echo "make deps             resolve dependências Go (gera go.sum)"
	@echo "make test             roda os testes do núcleo"
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
		-ldflags "$(GO_LDFLAGS) -extldflags=-Wl,-z,max-page-size=16384" \
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
		-ldflags "$(GO_LDFLAGS)" \
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
