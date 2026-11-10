// Package iparrotcore é a entrada para gomobile (Android .aar / iOS .xcframework).
//
// Só usa tipos que o gomobile sabe exportar (string, error). É o equivalente,
// bem mais enxuto, do go/framework/bertybridge do Berty.
//
//	Android (Java/Kotlin): iparrotcore.Iparrotcore.start(dataDir)
//	iOS (Swift):           IparrotcoreStart(dataDir, &error)
package iparrotcore

import (
	"encoding/hex"
	"errors"
	"sync"

	"go.uber.org/zap"

	"iparrot/core/runtime"
)

var (
	mu      sync.Mutex
	current *runtime.Core
)

// Start sobe o núcleo e devolve um JSON {"url","port","token","version"}.
// Se já estiver no ar, devolve os dados da instância atual.
func Start(dataDir string) (string, error) {
	return StartWithKey(dataDir, "")
}

// StartWithKey é igual a Start, mas recebe a chave de armazenamento (64 caracteres
// hexadecimais = 32 bytes) guardada no Keystore do Android / Keychain do iOS.
func StartWithKey(dataDir string, storageKeyHex string) (string, error) {
	mu.Lock()
	defer mu.Unlock()

	if current != nil {
		return current.Info().JSON(), nil
	}
	if dataDir == "" {
		return "", errors.New("pasta de dados não informada")
	}

	var key []byte
	if storageKeyHex != "" {
		var err error
		if key, err = hex.DecodeString(storageKeyHex); err != nil {
			return "", errors.New("chave de armazenamento inválida")
		}
	}

	logger, err := zap.NewProduction()
	if err != nil {
		logger = zap.NewNop()
	}

	core, err := runtime.Start(runtime.Config{DataDir: dataDir, StorageKey: key, Logger: logger})
	if err != nil {
		return "", err
	}
	current = core
	return core.Info().JSON(), nil
}

// Stop encerra o núcleo (por exemplo, quando o app é fechado).
func Stop() error {
	mu.Lock()
	defer mu.Unlock()

	if current == nil {
		return nil
	}
	err := current.Stop()
	current = nil
	return err
}

// Version devolve a versão do núcleo.
func Version() string {
	return runtime.Version()
}
