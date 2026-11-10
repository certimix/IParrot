package node

import (
	"encoding/hex"
	"errors"
	"os"
	"testing"
)

func TestLoadOrCreateStorageKeys(t *testing.T) {
	dir := t.TempDir()

	first, err := loadOrCreateStorageKeys(dir, nil)
	if err != nil {
		t.Fatalf("primeira chamada: %v", err)
	}
	if len(first.Key) != keyLength {
		t.Fatalf("chave com %d bytes, esperado %d", len(first.Key), keyLength)
	}
	for name, salt := range map[string][]byte{"ipfs": first.IPFSSalt, "root": first.RootSalt, "db": first.DBSalt} {
		if len(salt) != saltLength {
			t.Fatalf("sal %s com %d bytes, esperado %d", name, len(salt), saltLength)
		}
	}
	if hex.EncodeToString(first.IPFSSalt) == hex.EncodeToString(first.RootSalt) {
		t.Fatal("sais deveriam ser diferentes entre si")
	}

	// Segunda chamada deve devolver exatamente os mesmos valores.
	again, err := loadOrCreateStorageKeys(dir, nil)
	if err != nil {
		t.Fatalf("segunda chamada: %v", err)
	}
	if hex.EncodeToString(again.Key) != hex.EncodeToString(first.Key) {
		t.Fatal("a chave mudou entre execuções")
	}
	if hex.EncodeToString(again.DBSalt) != hex.EncodeToString(first.DBSalt) {
		t.Fatal("o sal do banco mudou entre execuções")
	}

	// Permissão restrita no arquivo de chaves.
	info, err := os.Stat(dir + "/keys.json")
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("keys.json com permissão %v, esperado 0600", info.Mode().Perm())
	}
}

func TestExternalKeyIsNotPersisted(t *testing.T) {
	dir := t.TempDir()
	external := make([]byte, keyLength)
	for i := range external {
		external[i] = byte(i)
	}

	keys, err := loadOrCreateStorageKeys(dir, external)
	if err != nil {
		t.Fatalf("com chave externa: %v", err)
	}
	if hex.EncodeToString(keys.Key) != hex.EncodeToString(external) {
		t.Fatal("a chave externa não foi usada")
	}

	raw, err := os.ReadFile(dir + "/keys.json")
	if err != nil {
		t.Fatal(err)
	}
	if contains(string(raw), hex.EncodeToString(external)) {
		t.Fatal("a chave externa foi gravada em disco")
	}

	// Os sais precisam sobreviver, mesmo sem a chave no arquivo.
	again, err := loadOrCreateStorageKeys(dir, external)
	if err != nil {
		t.Fatal(err)
	}
	if hex.EncodeToString(again.RootSalt) != hex.EncodeToString(keys.RootSalt) {
		t.Fatal("o sal mudou entre execuções com chave externa")
	}
}

func TestRejectsBadInputs(t *testing.T) {
	if _, err := loadOrCreateStorageKeys(t.TempDir(), []byte("curta")); err == nil {
		t.Fatal("deveria recusar chave externa de tamanho errado")
	}

	dir := t.TempDir()
	if err := os.WriteFile(dir+"/keys.json", []byte("{nao e json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadOrCreateStorageKeys(dir, nil); err == nil {
		t.Fatal("deveria recusar keys.json corrompido")
	}
}

func contains(haystack, needle string) bool {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}

// --- cofre do sistema ---------------------------------------------------------

type fakeVault struct {
	ok      bool
	key     []byte
	getErr  error
	setErr  error
	written [][]byte
}

func (v *fakeVault) available() bool { return v.ok }

func (v *fakeVault) get() ([]byte, error) {
	if v.getErr != nil {
		return nil, v.getErr
	}
	return v.key, nil
}

func (v *fakeVault) set(key []byte) error {
	if v.setErr != nil {
		return v.setErr
	}
	v.key = append([]byte(nil), key...)
	v.written = append(v.written, v.key)
	return nil
}

func load(t *testing.T, dir string, external []byte, v *fakeVault) *storageKeys {
	t.Helper()
	keys, err := loadOrCreateStorageKeysWithVault(dir, external, v.available, v.get, v.set)
	if err != nil {
		t.Fatalf("carregar chaves: %v", err)
	}
	return keys
}

func TestCofreVazioGuardaAChaveNova(t *testing.T) {
	dir := t.TempDir()
	vault := &fakeVault{ok: true}

	keys := load(t, dir, nil, vault)
	if len(vault.written) != 1 {
		t.Fatalf("a chave deveria ter ido para o cofre, gravações: %d", len(vault.written))
	}
	if hex.EncodeToString(vault.key) != hex.EncodeToString(keys.Key) {
		t.Fatal("a chave usada é diferente da guardada no cofre")
	}
	if keys.VaultErr != nil {
		t.Fatalf("não deveria haver erro de cofre: %v", keys.VaultErr)
	}

	raw, err := os.ReadFile(dir + "/keys.json")
	if err != nil {
		t.Fatal(err)
	}
	if contains(string(raw), hex.EncodeToString(keys.Key)) {
		t.Fatal("com cofre disponível, a chave não pode ficar em keys.json")
	}

	// Segunda execução: a chave vem do cofre, sem gravar de novo.
	again := load(t, dir, nil, vault)
	if hex.EncodeToString(again.Key) != hex.EncodeToString(keys.Key) {
		t.Fatal("a chave mudou entre execuções com cofre")
	}
	if len(vault.written) != 1 {
		t.Fatalf("o cofre foi reescrito sem necessidade: %d gravações", len(vault.written))
	}
	if hex.EncodeToString(again.DBSalt) != hex.EncodeToString(keys.DBSalt) {
		t.Fatal("o sal mudou entre execuções")
	}
}

func TestCofreQueFalhaCaiNoArquivo(t *testing.T) {
	dir := t.TempDir()
	vault := &fakeVault{ok: true, setErr: errors.New("sem sessão gráfica")}

	keys := load(t, dir, nil, vault)
	if keys.VaultErr == nil {
		t.Fatal("a falha do cofre deveria ser reportada")
	}

	raw, err := os.ReadFile(dir + "/keys.json")
	if err != nil {
		t.Fatal(err)
	}
	if !contains(string(raw), hex.EncodeToString(keys.Key)) {
		t.Fatal("sem cofre, a chave precisa ficar em keys.json para o perfil não se perder")
	}

	// E na próxima vez a chave tem de ser a mesma, vinda do arquivo.
	again := load(t, dir, nil, vault)
	if hex.EncodeToString(again.Key) != hex.EncodeToString(keys.Key) {
		t.Fatal("a chave mudou depois de o cofre falhar")
	}
}

func TestCofreSumidoNaoGeraChaveNova(t *testing.T) {
	dir := t.TempDir()
	vault := &fakeVault{ok: true}
	first := load(t, dir, nil, vault)

	// O cofre some (libsecret desinstalado, sessão sem keyring).
	gone := &fakeVault{ok: false}
	_, err := loadOrCreateStorageKeysWithVault(dir, nil, gone.available, gone.get, gone.set)
	if err == nil {
		t.Fatal("sem o cofre, carregar deveria falhar em vez de inventar outra chave")
	}
	if !contains(err.Error(), "cofre") {
		t.Fatalf("a mensagem deveria apontar o cofre, veio: %v", err)
	}
	if len(first.Key) != keyLength {
		t.Fatal("sanidade: a primeira chave deveria existir")
	}
}

func TestChaveExternaIgnoraOCofre(t *testing.T) {
	dir := t.TempDir()
	external := make([]byte, keyLength)
	for i := range external {
		external[i] = byte(255 - i)
	}
	vault := &fakeVault{ok: true, key: make([]byte, keyLength)}

	keys := load(t, dir, external, vault)
	if hex.EncodeToString(keys.Key) != hex.EncodeToString(external) {
		t.Fatal("a chave do sistema nativo deveria ter prioridade sobre o cofre")
	}
	if len(vault.written) != 0 {
		t.Fatal("com chave externa, nada deveria ser gravado no cofre")
	}
}
