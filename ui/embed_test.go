package ui

import (
	"io/fs"
	"strings"
	"testing"
)

func TestDist(t *testing.T) {
	sub, err := Dist()
	if err != nil {
		// Antes de `make ui` a pasta tem só o marcador: o erro precisa orientar.
		if !strings.Contains(err.Error(), "make ui") {
			t.Fatalf("a mensagem deveria orientar o build, veio: %v", err)
		}
		return
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		t.Fatalf("index.html deveria estar embutido: %v", err)
	}
}

func TestEmbedEncontraOMarcador(t *testing.T) {
	// Prova que o padrão all:dist casa com um arquivo iniciado por ponto.
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fs.Stat(sub, ".gitkeep"); err != nil {
		t.Fatalf("o marcador não foi embutido: %v", err)
	}
}
