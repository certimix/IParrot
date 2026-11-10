//go:build windows

package node

import (
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"
)

// No Windows o cofre é a DPAPI: a chave é cifrada com o segredo da conta do
// usuário e guardada em `storage-key.dpapi`, ao lado dos dados. Outro usuário
// da mesma máquina não consegue decifrar.
var (
	crypt32             = syscall.NewLazyDLL("crypt32.dll")
	kernel32            = syscall.NewLazyDLL("kernel32.dll")
	procProtectData     = crypt32.NewProc("CryptProtectData")
	procUnprotectData   = crypt32.NewProc("CryptUnprotectData")
	procLocalFree       = kernel32.NewProc("LocalFree")
	errVaultNoHomeDir   = errors.New("não foi possível localizar a pasta do usuário")
	cryptProtectEntropy = []byte("IParrot storage key v1")
)

type dataBlob struct {
	cbData uint32
	pbData *byte
}

func newBlob(b []byte) dataBlob {
	if len(b) == 0 {
		return dataBlob{}
	}
	return dataBlob{cbData: uint32(len(b)), pbData: &b[0]}
}

func (b dataBlob) bytes() []byte {
	if b.cbData == 0 || b.pbData == nil {
		return nil
	}
	out := make([]byte, b.cbData)
	copy(out, unsafe.Slice(b.pbData, b.cbData))
	return out
}

func (b dataBlob) free() {
	if b.pbData != nil {
		_, _, _ = procLocalFree.Call(uintptr(unsafe.Pointer(b.pbData)))
	}
}

func vaultPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", errVaultNoHomeDir
	}
	dir := filepath.Join(base, vaultService)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return filepath.Join(dir, vaultAccount+".dpapi"), nil
}

func vaultAvailableOS() bool {
	if err := procProtectData.Find(); err != nil {
		return false
	}
	_, err := vaultPath()
	return err == nil
}

func vaultGetOS() ([]byte, error) {
	path, err := vaultPath()
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	sealed, err := hex.DecodeString(string(raw))
	if err != nil {
		return nil, fmt.Errorf("cofre do Windows: conteúdo inválido: %w", err)
	}

	in := newBlob(sealed)
	entropy := newBlob(cryptProtectEntropy)
	var out dataBlob
	ret, _, callErr := procUnprotectData.Call(
		uintptr(unsafe.Pointer(&in)),
		0,
		uintptr(unsafe.Pointer(&entropy)),
		0, 0, 0,
		uintptr(unsafe.Pointer(&out)),
	)
	if ret == 0 {
		return nil, fmt.Errorf("cofre do Windows: não foi possível decifrar a chave: %w", callErr)
	}
	defer out.free()
	return out.bytes(), nil
}

func vaultSetOS(key []byte) error {
	path, err := vaultPath()
	if err != nil {
		return err
	}

	in := newBlob(key)
	entropy := newBlob(cryptProtectEntropy)
	var out dataBlob
	ret, _, callErr := procProtectData.Call(
		uintptr(unsafe.Pointer(&in)),
		0,
		uintptr(unsafe.Pointer(&entropy)),
		0, 0, 0,
		uintptr(unsafe.Pointer(&out)),
	)
	if ret == 0 {
		return fmt.Errorf("cofre do Windows: não foi possível cifrar a chave: %w", callErr)
	}
	defer out.free()

	return os.WriteFile(path, []byte(hex.EncodeToString(out.bytes())), 0o600)
}
