#!/usr/bin/env python3
"""Confere que as obrigações de licença de terceiros continuam íntegras.

Por que existe
--------------
O código do IParrot é proprietário, mas ele usa Berty e weshnet (Apache-2.0
ou MIT) e carrega uma cópia do driver GORM/SQLCipher (MIT). Essas licenças
exigem que o aviso de direitos autorais e o texto da licença acompanhem
**toda** distribuição do aplicativo. Fechar o código do IParrot não dispensa
nada disso.

Na prática, a obrigação vive em três lugares que precisam concordar:

  THIRD_PARTY_LICENSES/            o que acompanha os binários
  ui/src/inspirations/texts/       o que o app mostra em Configurações >
                                   Sobre > Inspirações
  NOTICE.md                        o resumo legível

Uma dependência adicionada sem a licença, um arquivo renomeado só de um lado,
ou as duas cópias saindo de sincronia são falhas silenciosas: ninguém percebe
até alguém cobrar. Este script falha alto em vez disso.

O que ele garante
-----------------
  1. toda licença citada na tela Inspirações existe de fato;
  2. nenhum arquivo de licença ficou órfão, sem ser citado;
  3. as duas cópias (raiz e app) têm os mesmos nomes e os mesmos bytes;
  4. todo projeto da tela aparece no NOTICE.md;
  5. todo projeto cujo código entra no app está na seção do NOTICE.md que
     trata disso.
"""

from __future__ import annotations

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
INDEX = RAIZ / "ui" / "src" / "inspirations" / "index.ts"
TEXTOS = RAIZ / "ui" / "src" / "inspirations" / "texts"
RAIZ_LIC = RAIZ / "THIRD_PARTY_LICENSES"
NOTICE = RAIZ / "NOTICE.md"

# Título da seção do NOTICE.md que lista o código efetivamente embarcado.
SECAO_EMBARCADO = "## Código que faz parte do aplicativo"


class Projeto:
    def __init__(self, ident: str, trecho: str) -> None:
        self.id = ident
        m = re.search(r"repo:\s*'([^']+)'", trecho)
        self.repo = m.group(1) if m else ""
        m = re.search(r"name:\s*'([^']+)'", trecho)
        self.name = m.group(1) if m else ident
        self.bundled = re.search(r"bundled:\s*true", trecho) is not None
        self.arquivos = re.findall(r"file:\s*'([^']+)'", trecho)


def ler_projetos() -> list[Projeto]:
    texto = INDEX.read_text(encoding="utf-8")
    # Cada item do array começa por `id: '...'`; o trecho de um item vai até o
    # início do próximo.
    marcas = list(re.finditer(r"id:\s*'([^']+)'", texto))
    projetos = []
    for i, m in enumerate(marcas):
        fim = marcas[i + 1].start() if i + 1 < len(marcas) else len(texto)
        projetos.append(Projeto(m.group(1), texto[m.start():fim]))
    return projetos


def main() -> int:
    for caminho in (INDEX, TEXTOS, RAIZ_LIC, NOTICE):
        if not caminho.exists():
            print(f"conferir-licencas: falta {caminho.relative_to(RAIZ)}", file=sys.stderr)
            return 1

    projetos = ler_projetos()
    if not projetos:
        print("conferir-licencas: nenhum projeto lido de index.ts", file=sys.stderr)
        return 1

    notice = NOTICE.read_text(encoding="utf-8")
    if SECAO_EMBARCADO in notice:
        _, depois = notice.split(SECAO_EMBARCADO, 1)
        secao_embarcado = depois.split("\n## ", 1)[0]
    else:
        secao_embarcado = ""

    problemas: list[str] = []
    citados: set[str] = set()

    # 1 e 4 e 5
    for p in projetos:
        for arq in p.arquivos:
            citados.add(arq)
            if not (TEXTOS / arq).exists():
                problemas.append(f"{p.id}: cita '{arq}', que não existe em ui/src/inspirations/texts/")
        if p.repo and p.repo not in notice and p.name not in notice:
            problemas.append(f"{p.id}: não aparece no NOTICE.md (nem pelo repo nem pelo nome)")
        if p.bundled and not secao_embarcado:
            problemas.append(f"NOTICE.md: seção '{SECAO_EMBARCADO}' não encontrada")
        elif p.bundled and p.repo not in secao_embarcado and p.name not in secao_embarcado:
            problemas.append(
                f"{p.id}: tem código embarcado (bundled: true) mas não está na seção "
                f"'{SECAO_EMBARCADO}' do NOTICE.md"
            )

    # 2
    no_disco = {f.name for f in TEXTOS.glob("*.txt")}
    for orfao in sorted(no_disco - citados):
        problemas.append(f"'{orfao}' está em texts/ mas nenhum projeto o cita: ou falta citar, ou sobra o arquivo")

    # 3
    na_raiz = {f.name for f in RAIZ_LIC.glob("*.txt")}
    for so_na_raiz in sorted(na_raiz - no_disco):
        problemas.append(f"'{so_na_raiz}' está em THIRD_PARTY_LICENSES/ mas não em texts/: o app não mostra essa licença")
    for so_no_app in sorted(no_disco - na_raiz):
        problemas.append(f"'{so_no_app}' está em texts/ mas não em THIRD_PARTY_LICENSES/: não acompanha os binários")
    for nome in sorted(na_raiz & no_disco):
        if (RAIZ_LIC / nome).read_bytes() != (TEXTOS / nome).read_bytes():
            problemas.append(f"'{nome}' difere entre THIRD_PARTY_LICENSES/ e texts/: o app mostra um texto e o binário acompanha outro")

    embarcados = [p.id for p in projetos if p.bundled]
    print(f"projetos na tela Inspirações: {len(projetos)} ({len(embarcados)} com código embarcado)")
    print(f"arquivos de licença: {len(no_disco)} no app, {len(na_raiz)} na raiz")
    print()

    if problemas:
        for p in problemas:
            print(f"  FALHA  {p}")
        print()
        print(f"conferir-licencas: {len(problemas)} problema(s)", file=sys.stderr)
        return 1

    print("conferir-licencas: as duas cópias concordam e o NOTICE.md cobre todos os projetos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
