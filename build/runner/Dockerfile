# Runner próprio do GitHub Actions para o IParrot.
#
# Por que existe: em repositório privado o plano Free do GitHub dá 2.000
# minutos de Actions por mês. Quando acabam, os jobs param de iniciar — a
# falha aparece como um job encerrado em dois segundos, sem nenhum passo e sem
# log, com a anotação "The job was not started because an Actions budget is
# preventing further use". Um runner próprio não consome minuto nenhum: o
# GitHub só coordena, a máquina é sua.
#
# ISOLAMENTO (regra inviolável do projeto): este container não vê nem toca em
# nada do servidor. Não monta o socket do Docker, não monta pasta do host, não
# roda privilegiado, não abre porta (ele liga para o GitHub, nunca o
# contrário), tem rede própria e teto de CPU e memória definidos no
# docker-compose.yml. Nada é instalado no host — Go, JDK, Android SDK e Node
# vivem aqui dentro.
#
# A mesma base do banco de build em build/docker/, mais o que o Android exige.

ARG GO_IMAGE=golang:1.26.5-bookworm
FROM ${GO_IMAGE}

ARG DEBIAN_FRONTEND=noninteractive

# build-essential e pkg-config: CGO, porque o SQLCipher é C.
# libgtk-3-dev e libwebkit2gtk-4.1-dev: app desktop Linux (Wails).
# libicu/libkrb5/libssl/zlib: exigências do runner do Actions (.NET).
RUN apt-get update && apt-get install -y --no-install-recommends \
		build-essential \
		pkg-config \
		ca-certificates \
		curl \
		git \
		jq \
		unzip \
		zip \
		xz-utils \
		libgtk-3-dev \
		libwebkit2gtk-4.1-dev \
		libicu72 \
		libkrb5-3 \
		libssl3 \
		zlib1g \
	&& rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Os dois JDKs, pelo mesmo motivo que o workflow instala dois: o gomobile gera
# o .aar chamando `javac -source 1.7`, que o 21 recusa; o Gradle do Capacitor
# (AGP 8.7) exige o 21. Vêm da Adoptium em vez do apt porque o bookworm não
# empacota o 21.
# ---------------------------------------------------------------------------
ARG JDK17_URL=https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse
ARG JDK21_URL=https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse
RUN mkdir -p /opt/jdk-17 /opt/jdk-21 \
	&& curl -fsSL "${JDK17_URL}" | tar -xz -C /opt/jdk-17 --strip-components=1 \
	&& curl -fsSL "${JDK21_URL}" | tar -xz -C /opt/jdk-21 --strip-components=1 \
	&& /opt/jdk-17/bin/javac -version \
	&& /opt/jdk-21/bin/javac -version

# O 21 é o padrão, que é o que o Gradle usa. O 17 fica no caminho que o
# Makefile espera receber em JAVA_HOME_GOMOBILE.
ENV JAVA_HOME=/opt/jdk-21 \
	JAVA_HOME_17=/opt/jdk-17 \
	PATH=/opt/jdk-21/bin:${PATH}

# ---------------------------------------------------------------------------
# Node para a interface, direto do tarball oficial (não mexe no apt).
# ---------------------------------------------------------------------------
ARG NODE_VERSION=22.14.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
		| tar -xJ -C /usr/local --strip-components=1 \
		--exclude=CHANGELOG.md --exclude=LICENSE --exclude=README.md \
	&& node --version && npm --version

# ---------------------------------------------------------------------------
# CLI do Wails, fixada na mesma versão do go.mod.
# ---------------------------------------------------------------------------
ARG WAILS_VERSION=v2.17.1
RUN go install github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION} \
	&& mv /go/bin/wails /usr/local/bin/wails

# ---------------------------------------------------------------------------
# Android SDK e NDK.
#
# As versões espelham o projeto: compileSdk/targetSdk 35 e minSdk 23 em
# mobile/android/variables.gradle, ANDROID_API 23 no Makefile.
#
# Se o zip das command-line tools der 404, o número do build mudou: pegue o
# atual em https://developer.android.com/studio#command-line-tools-only e
# passe em --build-arg CMDLINE_TOOLS_ZIP=...
# ---------------------------------------------------------------------------
ARG CMDLINE_TOOLS_ZIP=commandlinetools-linux-11076708_latest.zip
ARG ANDROID_PLATFORM=35
ARG ANDROID_BUILD_TOOLS=35.0.0
ARG ANDROID_NDK=26.3.11579264

ENV ANDROID_HOME=/opt/android-sdk \
	ANDROID_SDK_ROOT=/opt/android-sdk

RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" \
	&& curl -fsSL -o /tmp/cmdline-tools.zip \
		"https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP}" \
	&& unzip -q /tmp/cmdline-tools.zip -d "${ANDROID_HOME}/cmdline-tools" \
	&& mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest" \
	&& rm /tmp/cmdline-tools.zip \
	# `yes` aceita as licenças do SDK: sem isso o sdkmanager fica esperando
	# resposta e o build do container travaria.
	&& yes | "${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null \
	&& "${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager" \
		"platform-tools" \
		"platforms;android-${ANDROID_PLATFORM}" \
		"build-tools;${ANDROID_BUILD_TOOLS}" \
		"ndk;${ANDROID_NDK}" \
	&& rm -rf /root/.android

# O workflow lê ANDROID_NDK_LATEST_HOME, que é o nome que o runner do GitHub
# usa; definindo aqui, o mesmo passo funciona nos dois lugares sem alteração.
ENV ANDROID_NDK_HOME=${ANDROID_HOME}/ndk/${ANDROID_NDK} \
	ANDROID_NDK_LATEST_HOME=${ANDROID_HOME}/ndk/${ANDROID_NDK} \
	PATH=${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}

# ---------------------------------------------------------------------------
# O runner do Actions.
#
# A versão não vem fixada de propósito: o runner se atualiza sozinho e uma
# versão muito antiga é recusada pelo GitHub. Para fixar, passe
# --build-arg RUNNER_VERSION=2.330.0
# ---------------------------------------------------------------------------
ARG RUNNER_VERSION=
RUN set -eux; \
	v="${RUNNER_VERSION}"; \
	if [ -z "$v" ]; then \
		v="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/^v//')"; \
	fi; \
	echo "runner ${v}"; \
	mkdir -p /opt/actions-runner; \
	curl -fsSL -o /tmp/runner.tar.gz \
		"https://github.com/actions/runner/releases/download/v${v}/actions-runner-linux-x64-${v}.tar.gz"; \
	tar -xzf /tmp/runner.tar.gz -C /opt/actions-runner; \
	rm /tmp/runner.tar.gz

# ---------------------------------------------------------------------------
# Usuário sem privilégio. O runner recusa rodar como root sem uma variável de
# escape, e aqui não há motivo para abrir essa exceção.
# ---------------------------------------------------------------------------
RUN useradd --uid 1001 --create-home --shell /bin/bash runner \
	&& mkdir -p /opt/cache/go/mod /opt/cache/go/build /opt/cache/gradle \
		/opt/cache/npm /opt/cache/tools \
	&& chown -R runner:runner /opt/actions-runner /opt/cache /go

# Caches em volume: o segundo build não baixa os ~600 módulos de novo nem o
# Gradle inteiro.
ENV GOPATH=/go \
	GOMODCACHE=/opt/cache/go/mod \
	GOCACHE=/opt/cache/go/build \
	GRADLE_USER_HOME=/opt/cache/gradle \
	npm_config_cache=/opt/cache/npm \
	GOFLAGS=-modcacherw \
	CGO_ENABLED=1

# Onde setup-go, setup-node e setup-java guardam o que baixam. Fica no volume
# de cache, então na segunda execução eles não baixam nada.
ENV AGENT_TOOLSDIRECTORY=/opt/cache/tools

COPY --chown=runner:runner entrada.sh /usr/local/bin/entrada.sh
RUN chmod +x /usr/local/bin/entrada.sh

USER runner
WORKDIR /opt/actions-runner

# Sem HEALTHCHECK: o runner não escuta em porta nenhuma: ele abre uma conexão
# de saída para o GitHub e espera trabalho. Quem diz se está vivo é a lista de
# runners em Settings > Actions > Runners.
ENTRYPOINT ["/usr/local/bin/entrada.sh"]
