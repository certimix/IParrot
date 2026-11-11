#!/usr/bin/env bash
# Registra o runner no repositório e fica esperando trabalho.
#
# Duas formas de autenticar, nesta ordem de preferência:
#
#   GH_PAT        um token de acesso pessoal com permissão de administração
#                 SOMENTE neste repositório. Com ele o container cria o próprio
#                 token de registro a cada partida, então sobrevive a reinício
#                 e a `docker compose down` sem você tocar em nada.
#
#   RUNNER_TOKEN  o token de registro que aparece em
#                 Settings > Actions > Runners > New self-hosted runner.
#                 Vale uma hora e serve só para o primeiro registro; depois
#                 disso o runner guarda a própria credencial no volume.
#
# Nenhum dos dois é gravado em imagem ou em log: vêm do .env, que está no
# .gitignore.

set -euo pipefail

erro() { echo "runner: $*" >&2; exit 1; }

: "${REPO:?defina REPO=dono/repositorio no .env}"
RUNNER_NAME="${RUNNER_NAME:-iparrot-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-iparrot-vps}"
RUNNER_GROUP="${RUNNER_GROUP:-Default}"

api() {
	curl -fsSL -X POST \
		-H "Accept: application/vnd.github+json" \
		-H "Authorization: Bearer ${GH_PAT}" \
		-H "X-GitHub-Api-Version: 2022-11-28" \
		"https://api.github.com/repos/${REPO}/actions/runners/$1" \
		| jq -r .token
}

# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------
if [ ! -f .runner ]; then
	token=""
	if [ -n "${GH_PAT:-}" ]; then
		echo "runner: pedindo token de registro ao GitHub"
		token="$(api registration-token)" || erro "o GitHub recusou o GH_PAT. Confira se ele tem permissão de administração neste repositório e se não expirou."
	elif [ -n "${RUNNER_TOKEN:-}" ]; then
		token="${RUNNER_TOKEN}"
	else
		erro "defina GH_PAT ou RUNNER_TOKEN no .env (veja o README.md desta pasta)."
	fi

	echo "runner: registrando '${RUNNER_NAME}' em ${REPO} com as etiquetas ${RUNNER_LABELS}"
	# --replace evita erro quando um runner com o mesmo nome ficou pendurado
	# como offline depois de uma parada abrupta.
	./config.sh \
		--unattended \
		--replace \
		--url "https://github.com/${REPO}" \
		--token "${token}" \
		--name "${RUNNER_NAME}" \
		--labels "${RUNNER_LABELS}" \
		--runnergroup "${RUNNER_GROUP}" \
		--work _work
	unset token
else
	echo "runner: já registrado (credencial no volume), seguindo"
fi

# ---------------------------------------------------------------------------
# Saída limpa: ao receber o sinal de parada, tira o runner da lista do
# repositório em vez de deixá-lo lá como offline. Só é possível com GH_PAT,
# porque o token de remoção também precisa ser criado na hora.
# ---------------------------------------------------------------------------
desregistrar() {
	echo "runner: parando"
	if [ -n "${GH_PAT:-}" ]; then
		if t="$(api remove-token)"; then
			./config.sh remove --token "${t}" || true
		fi
	fi
	exit 0
}
trap desregistrar SIGTERM SIGINT

# run.sh em segundo plano para que o trap acima seja atendido na hora; com
# `exec` o sinal iria para o runner e a limpeza nunca rodaria.
./run.sh &
wait $!
