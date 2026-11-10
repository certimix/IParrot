# Servidor de apoio do IParrot: ponto de encontro (rendezvous) + relay.
#
# É o `rdvp` do Berty, que faz as duas funções num processo só — o relay v2 do
# libp2p sobe junto, com limites liberados (go/cmd/rdvp/main.go).
#
# Ele não lê mensagem nenhuma: só ajuda dois aparelhos a se acharem e, quando
# os dois estão atrás de roteador, repassa bytes já criptografados.

ARG GO_IMAGE=golang:1.26.5-bookworm
FROM ${GO_IMAGE} AS build

WORKDIR /build
# Aproveita o go.mod do IParrot: o módulo do Berty já é dependência dele, então
# o rdvp sai da mesma árvore, sem clonar repositório nenhum.
COPY go.mod go.sum* ./
RUN go mod download berty.tech/berty/v2
RUN CGO_ENABLED=0 go build -trimpath -ldflags '-s -w' \
	-o /out/rdvp berty.tech/berty/v2/go/cmd/rdvp

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/* \
	&& useradd --system --home /data --uid 10200 iparrot
COPY --from=build /out/rdvp /usr/local/bin/rdvp

USER iparrot
WORKDIR /data
# 4040/tcp e 4141/udp são os padrões do rdvp.
EXPOSE 4040/tcp 4141/udp
ENTRYPOINT ["rdvp"]
CMD ["serve"]
