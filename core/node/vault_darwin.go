//go:build darwin

package node

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

// No macOS o cofre é o Keychain, pelo utilitário `security`, que já vem no
// sistema. A chave vai em hexadecimal porque o `security` trabalha com texto.

func securityBin() (string, error) {
	return exec.LookPath("security")
}

func vaultAvailableOS() bool {
	_, err := securityBin()
	return err == nil
}

func vaultGetOS() ([]byte, error) {
	bin, err := securityBin()
	if err != nil {
		return nil, err
	}

	var out, stderr bytes.Buffer
	cmd := exec.Command(bin, "find-generic-password", "-s", vaultService, "-a", vaultAccount, "-w")
	cmd.Stdout = &out
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		// 44 = item não encontrado: primeira execução, não é erro.
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) && exitErr.ExitCode() == 44 {
			return nil, nil
		}
		return nil, fmt.Errorf("Keychain: %s", strings.TrimSpace(stderr.String()))
	}

	key, err := hex.DecodeString(strings.TrimSpace(out.String()))
	if err != nil {
		return nil, fmt.Errorf("Keychain: conteúdo inválido: %w", err)
	}
	return key, nil
}

func vaultSetOS(key []byte) error {
	bin, err := securityBin()
	if err != nil {
		return err
	}

	var stderr bytes.Buffer
	// -U atualiza se já existir; -T "" impede que outros programas leiam sem autorização.
	cmd := exec.Command(bin, "add-generic-password",
		"-s", vaultService, "-a", vaultAccount,
		"-w", hex.EncodeToString(key),
		"-l", "IParrot — chave de armazenamento",
		"-U", "-T", "")
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("Keychain: %s", strings.TrimSpace(stderr.String()))
	}
	return nil
}
