//go:build linux && !android

package node

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"os/exec"
	"strings"
)

// No Linux o cofre é o Secret Service (GNOME Keyring, KWallet e afins), pelo
// `secret-tool` do libsecret. Em servidor sem sessão gráfica o utilitário não
// existe, ou não acha o serviço: nesse caso o IParrot volta ao keys.json.

func secretToolBin() (string, error) {
	return exec.LookPath("secret-tool")
}

func vaultAvailableOS() bool {
	bin, err := secretToolBin()
	if err != nil {
		return false
	}
	// Uma busca que não acha nada ainda sai com código 1; o que importa é o
	// serviço responder em vez de recusar a conexão.
	var stderr bytes.Buffer
	cmd := exec.Command(bin, "lookup", "service", vaultService, "account", vaultAccount)
	cmd.Stderr = &stderr
	_ = cmd.Run()
	return !strings.Contains(stderr.String(), "Cannot autolaunch") &&
		!strings.Contains(stderr.String(), "was not provided by any .service")
}

func vaultGetOS() ([]byte, error) {
	bin, err := secretToolBin()
	if err != nil {
		return nil, err
	}

	var out, stderr bytes.Buffer
	cmd := exec.Command(bin, "lookup", "service", vaultService, "account", vaultAccount)
	cmd.Stdout = &out
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if stderr.Len() == 0 {
			return nil, nil // nada guardado ainda
		}
		return nil, fmt.Errorf("Secret Service: %s", strings.TrimSpace(stderr.String()))
	}

	value := strings.TrimSpace(out.String())
	if value == "" {
		return nil, nil
	}
	key, err := hex.DecodeString(value)
	if err != nil {
		return nil, fmt.Errorf("Secret Service: conteúdo inválido: %w", err)
	}
	return key, nil
}

func vaultSetOS(key []byte) error {
	bin, err := secretToolBin()
	if err != nil {
		return err
	}

	var stderr bytes.Buffer
	cmd := exec.Command(bin, "store", "--label=IParrot — chave de armazenamento",
		"service", vaultService, "account", vaultAccount)
	cmd.Stdin = strings.NewReader(hex.EncodeToString(key))
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("Secret Service: %s", strings.TrimSpace(stderr.String()))
	}
	return nil
}
