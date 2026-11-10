#!/usr/bin/env bash
# Bancada de build do IParrot em container, sem tocar no servidor.
#
#   ./build/docker/iparrot.sh imagem    monta a imagem (uma vez)
#   ./build/docker/iparrot.sh deps      resolve as dependências Go (gera go.sum)
#   ./build/docker/iparrot.sh test      roda os testes do núcleo
#   ./build/docker/iparrot.sh build     compila iparrotd + desktop Linux
#   ./build/docker/iparrot.sh run       sobe o iparrotd em 127.0.0.1:7788
#   ./build/docker/iparrot.sh shell     abre um terminal dentro do container
#   ./build/docker/iparrot.sh limpar    apaga imagem, volumes e dados de teste
#
# Nada é publicado para fora da máquina: a porta fica presa em 127.0.0.1 e o
# acesso de outro computador é por túnel SSH (ver build/docker/README.md).
set -euo pipefail

# Prefixo próprio em tudo, para não se misturar com outros containers.
readonly NS=iparrot-build
readonly IMAGE=$NS:latest
readonly NET=$NS-net
readonly VOL_GOMOD=$NS-gomod
readonly VOL_GOCACHE=$NS-gocache
readonly VOL_NPM=$NS-npm
readonly VOL_DATA=$NS-data
readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

docker_run() {
	docker run --rm -it \
		--name "$NS-$1" \
		--network "$NET" \
		-v "$ROOT:/src" \
		-v "$VOL_GOMOD:/go/pkg/mod" \
		-v "$VOL_GOCACHE:/root/.cache/go-build" \
		-v "$VOL_NPM:/root/.npm" \
		-v "$VOL_DATA:/data" \
		-e HOME=/root \
		"${@:2}"
}

ensure_net() {
	docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null
}

case "${1:-}" in
imagem)
	docker build -t "$IMAGE" "$ROOT/build/docker"
	;;
deps)
	ensure_net
	docker_run deps "$IMAGE" go mod tidy
	echo
	echo "Pronto. Faça commit do go.sum que apareceu em $ROOT."
	;;
test)
	ensure_net
	docker_run test "$IMAGE" make test
	;;
build)
	ensure_net
	docker_run build "$IMAGE" bash -lc 'make ui && make daemon && make desktop-linux'
	echo
	echo "Binários em $ROOT/build/bin/"
	;;
run)
	ensure_net
	echo "iparrotd em http://127.0.0.1:7788 — Ctrl+C encerra."
	docker_run run -p 127.0.0.1:7788:7788 "$IMAGE" \
		bash -lc './build/bin/iparrotd -dir /data/perfil -listen 0.0.0.0:7788'
	;;
shell)
	ensure_net
	docker_run shell "$IMAGE" bash
	;;
limpar)
	docker rm -f "$NS-shell" "$NS-run" 2>/dev/null || true
	docker rmi -f "$IMAGE" 2>/dev/null || true
	docker volume rm -f "$VOL_GOMOD" "$VOL_GOCACHE" "$VOL_NPM" "$VOL_DATA" 2>/dev/null || true
	docker network rm "$NET" 2>/dev/null || true
	echo "Removido tudo que começa com $NS. O resto da máquina não foi tocado."
	;;
*)
	# Mostra o cabeçalho de comentários como ajuda, sem repetir os textos.
	awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "${BASH_SOURCE[0]}"
	exit 1
	;;
esac
