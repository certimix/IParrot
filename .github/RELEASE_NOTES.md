Mensageiro ponto a ponto, criptografado de ponta a ponta, sem servidor central.

> **Esta é a primeira versão e ela nunca foi usada para valer.** O código compila nas cinco plataformas, mas trocar
> mensagens entre dois aparelhos ainda está sendo testado. Não use para nada que você não possa perder.

## O que baixar

| Arquivo | Para quem |
| --- | --- |
| `IParrot-*-windows-amd64.exe` | Windows 10 e 11. Executável direto, não precisa instalar. |
| `IParrot-*-android-debug.apk` | Android. APK de depuração — ver aviso abaixo. |
| `iparrot-*-linux-amd64.tar.gz` | Linux 64 bits. Traz o app com janela e o `iparrotd`, que roda sem interface gráfica. |

iPhone e iPad ficam de fora: um `.ipa` instalável exige conta Apple Developer.

Confira o download com `SHA256SUMS.txt`:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

## Instalar

**Windows** — extraia e execute. O SmartScreen vai dizer que não reconhece o aplicativo, porque ele não é assinado
digitalmente; em "Mais informações" aparece a opção de executar assim mesmo.

**Android** — o APK é de depuração, assinado com a chave de desenvolvimento do Android. Para instalar, o aparelho pede
que você libere "instalar aplicativos desconhecidos" para o app de onde vier o arquivo.

**Linux** — descompacte e rode `./iparrot`. Ele precisa do WebView do sistema:

```bash
sudo apt install libwebkit2gtk-4.1-0     # Debian, Ubuntu
```

Em servidor sem ambiente gráfico, use `./iparrotd`, que serve a mesma interface no navegador em `127.0.0.1:7788`.

## Primeiros passos

1. Abra o app e escolha um nome. Não há cadastro, telefone nem e-mail — sua identidade nasce e fica no aparelho.
2. Em **Meu código de contato**, mostre o QR para a outra pessoa ou copie o link e mande por onde preferir.
3. Quem recebe abre **+ → Adicionar contato**, lê o QR pela câmera ou cola o link, e manda o pedido.
4. Aceito o pedido, a conversa abre dos dois lados.

Os dois aparelhos precisam estar **online ao mesmo tempo**: não existe caixa postal guardando mensagem para quem está
desconectado. Esse servidor de replicação está no roadmap.

## Privacidade, sem rodeios

As mensagens são criptografadas de ponta a ponta e vão direto entre os aparelhos. Mas, sem configurar nada, o app usa
os servidores públicos de encontro e relay mantidos pela Berty Technologies. Eles não leem o conteúdo — veem quem fala
com quem e quando. Para não depender deles, suba o seu (`server/rdvp/` no repositório) e aponte em
**Configurações → Rede → Usar meus próprios servidores**.

O backup da conta, em **Configurações → Backup**, gera um `.tar` **não criptografado**: quem abrir aquele arquivo vira
você no IParrot. Guarde em lugar seguro.

## Créditos

O IParrot é construído sobre o [Berty](https://github.com/berty/berty) e o protocolo
[Wesh](https://github.com/berty/weshnet), com `go-orbit-db`, `go-ipfs-log` e `go-ipfs-repo-encrypted`. Todos os
projetos e suas licenças estão em **Configurações → Sobre → Inspirações**, dentro do app, e em
[NOTICE.md](../blob/main/NOTICE.md).

O código do IParrot é proprietário: todos os direitos reservados. As licenças das partes de terceiros continuam
valendo e acompanham esta distribuição, no app e no repositório.

Projeto independente, sem vínculo com a Berty Technologies.

## Mudanças desta versão

**Diagnóstico quando o contato não aparece.** A versão anterior falhava calada. Um pedido de contato enviado fica
procurando o outro aparelho em laço, e quando não acha — servidor fora de alcance, outro lado desligado — o protocolo
não devolve erro nem desiste. Na tela, isso era idêntico a estar só esperando resposta. Agora:

- a lista avisa, em destaque, quando este aparelho não está conectado a par nenhum — e leva direto à tela de Rede;
- cada pedido em "Aguardando" mostra há quanto tempo está esperando;
- **Configurações → Rede → Usar meus próprios servidores** lista os endereços que o aparelho está realmente usando.
  Enquanto você não configura os seus, o IParrot usa os servidores públicos do Berty, e isso não aparecia em lugar
  nenhum: os campos vinham vazios, como se não houvesse servidor.

**Marca.** A tela Sobre passa a trazer a assinatura AORDIC. O acesso às licenças de terceiros continua onde estava, com
outro nome: elas acompanham obrigatoriamente qualquer distribuição do aplicativo.

**Para quem compila.** `./build/docker/iparrot.sh apk` monta o APK em container, sem instalar Go, Android SDK, NDK nem
os dois JDKs na máquina. `make conferir` checa as restrições de build dos onze alvos e as obrigações de licença sem
precisar de compilador.
