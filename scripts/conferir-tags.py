#!/usr/bin/env python3
"""Confere as restrições //go:build do cofre de chaves sem precisar compilar.

Por que existe
--------------
O cofre de chaves (core/node/vault_*.go) tem uma implementação por sistema e
exatamente uma precisa valer para cada alvo. Errar isso custou duas execuções
inteiras de CI:

  - o iOS quebrou com `vaultGetOS redeclared in this block`, porque
    GOOS=ios satisfaz TAMBÉM a tag `darwin` — eu havia conferido o
    android/arm64 e presumido o resto;
  - o alvo genérico ficou sem arquivo em outra combinação.

Compilar para os onze alvos leva muito tempo e, sem rede para os módulos,
às vezes não é possível. Este script decide a mesma coisa lendo as tags, em
menos de um segundo, e é o que o `make conferir-tags` roda.

O que ele garante
-----------------
Para cada alvo: exatamente um dos arquivos do cofre é selecionado. Zero
significa símbolo faltando; dois ou mais, símbolo duplicado.

Regras do Go que importam aqui
------------------------------
  - GOOS=ios  satisfaz `ios`     E `darwin`
  - GOOS=android satisfaz `android` E `linux`
  - `unix` vale para linux, darwin, ios, android e os BSDs
Essas três são justamente as que enganam.
"""

from __future__ import annotations

import pathlib
import re
import sys

# Os alvos que o projeto compila, conforme o Makefile e o workflow.
ALVOS = [
    ("linux", "amd64"),
    ("linux", "arm64"),
    ("windows", "amd64"),
    ("windows", "arm64"),
    ("darwin", "amd64"),
    ("darwin", "arm64"),
    ("android", "arm64"),
    ("android", "amd64"),
    ("ios", "arm64"),
    ("ios", "amd64"),
    ("freebsd", "amd64"),
]

# GOOS que também satisfazem outra tag de sistema.
IMPLICACOES = {"ios": {"darwin"}, "android": {"linux"}}

UNIX = {"linux", "darwin", "ios", "android", "freebsd", "netbsd", "openbsd", "dragonfly", "solaris", "aix", "hurd"}


def tags_do_alvo(goos: str, goarch: str) -> set[str]:
    tags = {goos, goarch} | IMPLICACOES.get(goos, set())
    if goos in UNIX:
        tags.add("unix")
    # cgo fica ligado em todos os alvos do projeto (o SQLCipher é C).
    tags.add("cgo")
    return tags


def avaliar(expr: str, tags: set[str]) -> bool:
    """Avalia uma expressão //go:build em Python.

    A sintaxe do Go (&&, ||, !, parênteses) mapeia direto nos operadores
    `and`, `or`, `not` do Python; os identificadores viram True/False pela
    pertinência ao conjunto de tags.
    """
    # Os identificadores vêm primeiro, de propósito: trocar `&&` por `and`
    # antes disso faria o próprio `and` ser tratado como nome de tag.
    py = re.sub(
        r"[A-Za-z_][A-Za-z0-9_.]*",
        lambda m: "True" if m.group(0) in tags else "False",
        expr,
    )
    py = py.replace("&&", " and ").replace("||", " or ").replace("!", " not ")

    # Só sobraram literais, operadores e parênteses: nada de chamada de função
    # ou atributo pode ter escapado para dentro do eval.
    if re.sub(r"\b(True|False|and|or|not)\b|[()\s]", "", py):
        raise ValueError(f"expressão não reconhecida: {expr!r} -> {py!r}")
    return bool(eval(py, {"__builtins__": {}}, {}))  # noqa: S307 - entrada validada acima


def restricao(caminho: pathlib.Path) -> str | None:
    # A restrição tem de vir antes do `package`, então basta olhar o topo.
    for linha in caminho.read_text(encoding="utf-8").splitlines()[:20]:
        if linha.startswith("//go:build"):
            return linha[len("//go:build"):].strip()
        if linha.startswith("package "):
            return None
    return None


def autoteste() -> int:
    """Prova que o conferidor detecta os erros que já aconteceram.

    Um detector que nunca acusou nada não dá garantia nenhuma, então os dois
    casos reais ficam registrados aqui e `make conferir-tags` roda isto antes
    de olhar o código de verdade.
    """
    casos = [
        (
            "tag darwin sem `&& !ios` (a falha real do run da CI)",
            {
                # Era assim que estava: `darwin` puro, que GOOS=ios também
                # satisfaz, ao lado de um genérico que já previa o ios — então
                # os dois valiam no iOS ao mesmo tempo.
                "vault_darwin.go": "darwin",
                "vault_linux.go": "linux && !android",
                "vault_windows.go": "windows",
                "vault_other.go": "!windows && !(darwin && !ios) && !(linux && !android)",
            },
            ("ios", "arm64"),
            2,  # darwin e other juntos: `vaultGetOS redeclared in this block`
        ),
        (
            "alvo genérico ausente",
            {
                "vault_darwin.go": "darwin && !ios",
                "vault_linux.go": "linux && !android",
                "vault_windows.go": "windows",
            },
            ("android", "arm64"),
            0,  # nenhum arquivo: o cofre fica sem implementação
        ),
    ]

    falhas = 0
    for descricao, restricoes, alvo, esperado in casos:
        tags = tags_do_alvo(*alvo)
        obtido = sum(1 for r in restricoes.values() if avaliar(r, tags))
        marca = "ok     " if obtido == esperado else "FALHA  "
        if obtido != esperado:
            falhas += 1
        print(f"  {marca} {descricao}")
        print(f"          {alvo[0]}/{alvo[1]}: {obtido} arquivo(s), esperado {esperado}")

    if falhas:
        print("conferir-tags: o autoteste falhou, o conferidor está quebrado", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    if "--autoteste" in sys.argv:
        print("autoteste do conferidor:")
        return autoteste()

    raiz = pathlib.Path(__file__).resolve().parent.parent
    arquivos = sorted((raiz / "core" / "node").glob("vault_*.go"))
    if not arquivos:
        print("conferir-tags: nenhum core/node/vault_*.go encontrado", file=sys.stderr)
        return 1

    restricoes: dict[str, str] = {}
    for f in arquivos:
        r = restricao(f)
        if r is None:
            print(f"conferir-tags: {f.name} não tem //go:build", file=sys.stderr)
            return 1
        restricoes[f.name] = r

    print("restrições encontradas:")
    for nome, r in restricoes.items():
        print(f"  {nome:22} //go:build {r}")
    print()

    falhas = 0
    largura = max(len(n) for n in restricoes)
    for goos, goarch in ALVOS:
        tags = tags_do_alvo(goos, goarch)
        escolhidos = [n for n, r in restricoes.items() if avaliar(r, tags)]
        alvo = f"{goos}/{goarch}"
        if len(escolhidos) == 1:
            print(f"  ok      {alvo:16} -> {escolhidos[0]:{largura}}")
        else:
            falhas += 1
            if not escolhidos:
                print(f"  FALHA   {alvo:16} -> nenhum arquivo: o cofre fica sem implementação")
            else:
                print(f"  FALHA   {alvo:16} -> {len(escolhidos)} arquivos ({', '.join(escolhidos)}):")
                print(f"          {'':16}    símbolo duplicado, o compilador recusa")

    print()
    if falhas:
        print(f"conferir-tags: {falhas} alvo(s) com problema", file=sys.stderr)
        return 1
    print(f"conferir-tags: {len(ALVOS)} alvos, exatamente um arquivo em cada")
    return 0


if __name__ == "__main__":
    sys.exit(main())
