package node

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestLocalStatePersiste(t *testing.T) {
	dir := t.TempDir()

	s, err := LoadLocalState(dir)
	if err != nil {
		t.Fatal(err)
	}
	if s.IsHidden("conv-1") || s.IsBlocked("contato-1") {
		t.Fatal("estado novo deveria estar vazio")
	}

	if err := s.Hide("conv-1", true); err != nil {
		t.Fatal(err)
	}
	if err := s.Block("contato-1", true); err != nil {
		t.Fatal(err)
	}

	again, err := LoadLocalState(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !again.IsHidden("conv-1") {
		t.Fatal("a conversa oculta não sobreviveu ao reinício")
	}
	if !again.IsBlocked("contato-1") {
		t.Fatal("o bloqueio não sobreviveu ao reinício")
	}
	if got := again.Blocked(); len(got) != 1 || got[0] != "contato-1" {
		t.Fatalf("lista de bloqueados errada: %v", got)
	}

	// Desfazer também precisa persistir.
	if err := again.Block("contato-1", false); err != nil {
		t.Fatal(err)
	}
	third, err := LoadLocalState(dir)
	if err != nil {
		t.Fatal(err)
	}
	if third.IsBlocked("contato-1") {
		t.Fatal("o desbloqueio não foi gravado")
	}
	if !third.IsHidden("conv-1") {
		t.Fatal("desbloquear não pode mexer nas conversas ocultas")
	}
}

func TestLocalStateNaoDeixaArquivoTemporario(t *testing.T) {
	dir := t.TempDir()
	s, err := LoadLocalState(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Hide("x", true); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "local.json.tmp")); !os.IsNotExist(err) {
		t.Fatal("o arquivo temporário deveria ter sido renomeado")
	}
	info, err := os.Stat(filepath.Join(dir, "local.json"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("permissão %v, esperado 0600", info.Mode().Perm())
	}
}

func TestLocalStateArquivoCorrompido(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "local.json"), []byte("{quebrado"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadLocalState(dir); err == nil {
		t.Fatal("deveria recusar um local.json corrompido")
	}
}

func TestLocalStateConcorrente(t *testing.T) {
	dir := t.TempDir()
	s, err := LoadLocalState(dir)
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(2)
		go func(n int) {
			defer wg.Done()
			_ = s.Hide("conv", n%2 == 0)
		}(i)
		go func() {
			defer wg.Done()
			_ = s.IsHidden("conv")
			_ = s.Blocked()
		}()
	}
	wg.Wait()
}
