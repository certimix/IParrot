# Servidor de apoio do IParrot

## O que isto é — e o que não é

O IParrot **não se hospeda**. Ele é ponto a ponto: o app roda no celular e no
computador das pessoas, e as mensagens vão direto de um aparelho ao outro. Não
existe "subir o IParrot num servidor".

O que existe é um apoio para os aparelhos se acharem, e é isso que mora aqui:

- **ponto de encontro (rendezvous)** — onde um aparelho avisa "estou online" e
  descobre o endereço dos contatos;
- **relay** — quando os dois lados estão atrás de roteador e nenhum consegue
  abrir conexão direta, o relay repassa os bytes.

No Berty, as duas funções vêm no mesmo programa (`rdvp`): o relay v2 do libp2p
sobe junto com o servidor de encontro. Então é **um container só**.

**Ele não lê nada.** O conteúdo das mensagens é criptografado de ponta a ponta
no aparelho; pelo relay passam bytes que o servidor não consegue abrir. O que
ele vê é quem conversa com quem e quando — metadados, não conteúdo.

Sem este servidor, o IParrot usa os públicos da Berty Technologies, embutidos no
weshnet. Funcionam, mas são de terceiro e sem garantia nenhuma.

## Subir

Tudo leva o prefixo `iparrot-rdvp` e nada encosta em outro projeto da máquina.

```bash
cd /caminho/do/iparrot/server/rdvp

# 1. Gera a chave do servidor. Ela é a identidade dele: se trocar, todo mundo
#    que já anotou o endereço antigo deixa de achar o servidor.
docker compose -p iparrot-rdvp run --rm --entrypoint rdvp rdvp genkey > rdvp.key
chmod 600 rdvp.key

# 2. Arquivo .env com a chave e o endereço público
cat > .env <<EOF
IPARROT_PUBLIC_ADDR=SEU.IP.PUBLICO.AQUI
IPARROT_RDVP_KEY=$(cat rdvp.key)
EOF
chmod 600 .env

# 3. Sobe
docker compose -p iparrot-rdvp up -d --build
docker compose -p iparrot-rdvp logs -f
```

Nos logs, o `rdvp` imprime o Peer ID e os endereços que está anunciando.

## Pegar o endereço para colocar no app

```bash
docker compose -p iparrot-rdvp run --rm --entrypoint rdvp rdvp sharekey -pk "$(cat rdvp.key)"
```

Isso imprime o Peer ID (algo como `12D3KooW…`). O endereço completo fica:

```
/ip4/SEU.IP.PUBLICO/tcp/4040/p2p/12D3KooW…
/ip4/SEU.IP.PUBLICO/udp/4141/quic-v1/p2p/12D3KooW…
```

No app: **Configurações → Rede → Usar meus próprios servidores**, e cole as duas
linhas tanto em "Pontos de encontro" quanto em "Relays" — é o mesmo servidor
fazendo as duas coisas. Feche e abra o IParrot.

Com um domínio apontado para a VPS, troque `/ip4/IP/` por `/dns4/rdvp.seu-dominio/`:
o endereço continua valendo se o IP mudar.

## Firewall

Precisam estar abertos **4040/tcp** e **4141/udp**. O UDP é o QUIC, que é o que
funciona melhor atrás de NAT — não esqueça dele.

```bash
sudo ufw allow 4040/tcp
sudo ufw allow 4141/udp
```

Isto não é HTTP: não passa por Nginx, não precisa de certificado TLS e não
disputa as portas 80 e 443 com nada que já esteja no servidor.

## Manutenção

```bash
docker compose -p iparrot-rdvp ps
docker compose -p iparrot-rdvp logs --tail 100
docker compose -p iparrot-rdvp restart
docker compose -p iparrot-rdvp down            # para
docker compose -p iparrot-rdvp down -v         # para e apaga o banco
```

Consumo: alguns MB de RAM parado. O que pesa é o relay, e só quando há gente
usando — todo tráfego de quem não consegue conexão direta passa por aqui. Em
uso pessoal ou de uma equipe, é ruído; se o IParrot crescer, acompanhe a banda.

## Guardar a chave

O `rdvp.key` é a identidade do servidor. Perdeu, o endereço muda e todo mundo
precisa reconfigurar. Faça cópia dele junto com os outros segredos do servidor,
e não comite no Git — o `.gitignore` do projeto já cobre `server/rdvp/.env` e
`server/rdvp/rdvp.key`.
