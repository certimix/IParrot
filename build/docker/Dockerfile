# Ambiente de build do IParrot, isolado do servidor.
#
# Tudo que o núcleo precisa — Go, gcc, as bibliotecas de WebView do Wails,
# Node — vive aqui dentro. O servidor que roda este container não ganha um
# pacote sequer: nada de `apt install` no host, nada de Go no PATH do sistema.
#
# Se a tag abaixo não existir no Docker Hub, troque por uma próxima:
#   docker build --build-arg GO_IMAGE=golang:1.26.5-trixie ...
ARG GO_IMAGE=golang:1.26.5-bookworm
FROM ${GO_IMAGE}

# build-essential e pkg-config: CGO (o SQLCipher é C).
# libgtk-3-dev e libwebkit2gtk-4.1-dev: só para o app desktop Linux (Wails).
#   Para compilar apenas o iparrotd, dá para apagar estas duas linhas e a
#   imagem fica bem menor.
RUN apt-get update && apt-get install -y --no-install-recommends \
		build-essential \
		pkg-config \
		ca-certificates \
		git \
		libgtk-3-dev \
		libwebkit2gtk-4.1-dev \
	&& rm -rf /var/lib/apt/lists/*

# Node para a interface, direto do tarball oficial (não mexe no apt).
ARG NODE_VERSION=22.14.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
		| tar -xJ -C /usr/local --strip-components=1 \
		--exclude=CHANGELOG.md --exclude=LICENSE --exclude=README.md \
	&& node --version && npm --version

# CLI do Wails, fixada na mesma versão do go.mod.
ARG WAILS_VERSION=v2.17.1
RUN go install github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}

# O código é montado em /src; os caches ficam em volumes nomeados, para o
# segundo build não baixar os ~600 módulos de novo.
ENV GOFLAGS=-modcacherw \
	GOPATH=/go \
	CGO_ENABLED=1
WORKDIR /src

# Sem ENTRYPOINT de propósito: este container é uma bancada, não um serviço.
CMD ["bash"]
