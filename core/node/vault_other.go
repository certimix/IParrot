//go:build !windows && !(darwin && !ios) && !(linux && !android)

package node

import "errors"

// Android e iOS entregam a chave pronta pelo código nativo (Keystore e
// Keychain), em Config.StorageKey; os demais sistemas usam o keys.json.
//
// A tag exclui iOS do arquivo darwin de propósito: GOOS=ios também satisfaz a
// tag `darwin`, e o utilitário `security` do macOS não existe no iPhone.

var errNoVault = errors.New("este sistema não tem cofre de chaves integrado ao IParrot")

func vaultAvailableOS() bool { return false }

func vaultGetOS() ([]byte, error) { return nil, errNoVault }

func vaultSetOS([]byte) error { return errNoVault }
