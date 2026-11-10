# Bancada de build isolada

Compila o IParrot sem instalar nada no servidor. Útil quando a máquina já roda
outras coisas em produção e o build não pode encostar nelas.

## A regra

O host recebe **zero** pacote novo. Go, gcc, as bibliotecas de WebView e o Node
ficam todos dentro da imagem. O que o servidor precisa ter é só o Docker — que,
se ele já roda containers, já tem.

Tudo que esta bancada cria leva o prefixo `iparrot-build`:

| O que | Nome |
| --- | --- |
| Imagem | `iparrot-build:latest` |
| Rede | `iparrot-build-net` |
| Volumes | `iparrot-build-gomod`, `-gocache`, `-npm`, `-data` |
| Containers | `iparrot-build-deps`, `-test`, `-build`, `-run`, `-shell` |

Nenhum deles toca em container, rede, volume ou porta de outro projeto. Para
conferir antes e depois:

```bash
docker ps -a --format '{{.Names}}' | sort > /tmp/antes.txt
# … trabalha …
docker ps -a --format '{{.Names}}' | sort | diff /tmp/antes.txt -
```

## Uso

```bash
cd /caminho/do/iparrot
./build/docker/iparrot.sh imagem    # uma vez, ~10 min
./build/docker/iparrot.sh deps      # go mod tidy: resolve ~600 módulos
./build/docker/iparrot.sh test      # testes do núcleo
./build/docker/iparrot.sh build     # iparrotd + desktop Linux
```

Quando o `deps` ou o `build` quebrar — e é provável que quebre na primeira vez,
já que o núcleo nunca foi compilado —, abra um terminal dentro do container e
itere ali, que é mais rápido do que repetir o ciclo inteiro:

```bash
./build/docker/iparrot.sh shell
# dentro: go build ./core/... e vá corrigindo
```

O código vem montado de `/src`, então os arquivos que você editar na sua IDE
aparecem no container na hora, e os binários gerados aparecem em `build/bin/`
na máquina. Os caches de Go e npm vivem em volumes: o segundo build não baixa
nada de novo.

## Testar sem interface gráfica

O app desktop precisa de X11, que um servidor normalmente não tem. Use o
`iparrotd`, que serve a mesma interface no navegador:

```bash
./build/docker/iparrot.sh run
```

A porta fica presa em `127.0.0.1:7788` do servidor — de fora, ninguém alcança.
Para abrir no seu computador, faça um túnel SSH:

```bash
ssh -N -L 7788:127.0.0.1:7788 usuario@servidor
# e abra http://127.0.0.1:7788 no navegador local
```

O token aparece no terminal onde o `run` está rodando; a interface o lê do
endereço quando você abre o link que o próprio `iparrotd` imprime.

## Duas instâncias conversando

Para testar o IParrot de verdade são precisos dois nós. Abra dois terminais:

```bash
# terminal 1
docker run --rm -it --name iparrot-build-a --network iparrot-build-net \
  -v "$PWD:/src" -v iparrot-build-gomod:/go/pkg/mod -v iparrot-build-data:/data \
  -p 127.0.0.1:7788:7788 iparrot-build:latest \
  ./build/bin/iparrotd -dir /data/perfil-a -listen 0.0.0.0:7788

# terminal 2
docker run --rm -it --name iparrot-build-b --network iparrot-build-net \
  -v "$PWD:/src" -v iparrot-build-gomod:/go/pkg/mod -v iparrot-build-data:/data \
  -p 127.0.0.1:7789:7788 iparrot-build:latest \
  ./build/bin/iparrotd -dir /data/perfil-b -listen 0.0.0.0:7788
```

Dois túneis SSH, duas abas, e dá para trocar o código de contato entre elas.
Os dois containers estão na mesma rede Docker, então se acham pela rede local
mesmo sem rendezvous.

## Apagar sem deixar rastro

```bash
./build/docker/iparrot.sh limpar
```

Remove imagem, volumes, rede e containers com o prefixo `iparrot-build`. O
servidor volta exatamente ao que era.

## O que esta bancada não faz

- **iOS**: exige macOS com Xcode. Não há contorno em Linux.
- **Android**: dá para acrescentar JDK, SDK e NDK a este Dockerfile, mas a
  imagem passa de 6 GB. Mais barato deixar o APK para a CI (`make android` no
  GitHub Actions já está configurado).
- **Windows**: compilar o `.exe` aqui exige mingw-w64 e o Wails não gosta de
  cross-compile. Deixe na CI, ou compile numa máquina Windows.
