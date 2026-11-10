package node

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const (
	keyLength  = 32 // chave do SQLCipher
	saltLength = 16 // sal do SQLCipher (cabeçalho em texto plano, como no Berty)
)

// errVaultUnreachable acompanha a falha do cofre para ficar claro, no log e na
// tela, que o problema é o cofre e não os dados.
var errVaultUnreachable = errors.New(
	"abra a sessão do usuário (ou instale o libsecret, no Linux) e tente de novo")

// storageKeys guarda a chave e os sais usados para criptografar em disco
// o repositório IPFS, o datastore raiz do Wesh e o banco do mensageiro.
type storageKeys struct {
	Key      []byte
	IPFSSalt []byte
	RootSalt []byte
	DBSalt   []byte
	// VaultErr registra por que o cofre do sistema não foi usado, quando ele
	// existe mas falhou. Não impede o nó de subir.
	VaultErr error
}

type storageKeysFile struct {
	Version  int    `json:"version"`
	Key      string `json:"key,omitempty"`
	IPFSSalt string `json:"ipfsSalt"`
	RootSalt string `json:"rootSalt"`
	DBSalt   string `json:"dbSalt"`
}

// loadOrCreateStorageKeys lê (ou cria) `keys.json` dentro de dir.
//
// A chave vem, em ordem de preferência:
//
//  1. de externalKey, quando o código nativo já a obteve do Keystore do Android
//     ou do Keychain do iOS;
//  2. do cofre do sistema (DPAPI no Windows, Keychain no macOS, Secret Service
//     no Linux), criando-a ali na primeira execução;
//  3. de keys.json, com permissão 0600, quando não há cofre disponível.
//
// Nos dois primeiros casos a chave nunca é gravada em keys.json — só os sais,
// que são públicos por natureza (ficam no cabeçalho do SQLCipher).
//
// O terceiro caso protege contra leitura casual dos bancos, mas não contra quem
// tem acesso total à máquina. Ver docs/ARQUITETURA.md, "Chave de armazenamento".
func loadOrCreateStorageKeys(dir string, externalKey []byte) (*storageKeys, error) {
	return loadOrCreateStorageKeysWithVault(dir, externalKey, vaultAvailable, vaultGet, vaultSet)
}

// loadOrCreateStorageKeysWithVault é a versão testável: recebe o cofre como
// funções, para o teste poder simular um cofre vazio, cheio ou quebrado.
func loadOrCreateStorageKeysWithVault(
	dir string,
	externalKey []byte,
	available func() bool,
	get func() ([]byte, error),
	set func([]byte) error,
) (*storageKeys, error) {
	if len(externalKey) != 0 && len(externalKey) != keyLength {
		return nil, fmt.Errorf("chave de armazenamento inválida: esperado %d bytes, recebido %d", keyLength, len(externalKey))
	}

	// VaultErr guarda a falha do cofre para quem chamou poder registrar no log.
	var vaultErr error
	fromVault := len(externalKey) == 0 && available()
	if fromVault {
		key, err := get()
		switch {
		case err != nil:
			vaultErr = err
			fromVault = false
		case len(key) == keyLength:
			externalKey = key
		case len(key) != 0:
			vaultErr = fmt.Errorf("o cofre devolveu uma chave de %d bytes", len(key))
			fromVault = false
		}
	}

	path := filepath.Join(dir, "keys.json")
	file := storageKeysFile{}

	raw, err := os.ReadFile(path)
	switch {
	case err == nil:
		if err := json.Unmarshal(raw, &file); err != nil {
			return nil, fmt.Errorf("keys.json corrompido: %w", err)
		}
	case errors.Is(err, os.ErrNotExist):
		file.Version = 1
		if file.IPFSSalt, err = randomHex(saltLength); err != nil {
			return nil, err
		}
		if file.RootSalt, err = randomHex(saltLength); err != nil {
			return nil, err
		}
		if file.DBSalt, err = randomHex(saltLength); err != nil {
			return nil, err
		}
		if len(externalKey) == 0 {
			fresh, err := randomBytes(keyLength)
			if err != nil {
				return nil, err
			}
			if fromVault {
				// Cofre disponível e vazio: a chave nasce lá, não no arquivo.
				if err := set(fresh); err != nil {
					vaultErr = err
					file.Key = hex.EncodeToString(fresh)
				}
				externalKey = fresh
			} else {
				file.Key = hex.EncodeToString(fresh)
			}
		}
		out, err := json.MarshalIndent(file, "", "  ")
		if err != nil {
			return nil, err
		}
		if err := os.WriteFile(path, out, 0o600); err != nil {
			return nil, fmt.Errorf("não foi possível gravar keys.json: %w", err)
		}
	default:
		return nil, fmt.Errorf("não foi possível ler keys.json: %w", err)
	}

	keys := &storageKeys{Key: externalKey, VaultErr: vaultErr}
	if len(keys.Key) == 0 {
		if file.Key == "" {
			// A chave está no cofre do sistema, que agora não respondeu. Seguir
			// com uma chave nova destruiria o acesso aos bancos já criados.
			return nil, fmt.Errorf(
				"a chave deste perfil está no cofre do sistema e ele não respondeu: %w",
				errors.Join(vaultErr, errVaultUnreachable))
		}
		if keys.Key, err = decodeHex(file.Key, keyLength, "key"); err != nil {
			return nil, err
		}
		// Já existia em keys.json e agora há cofre: a chave fica onde está.
		// Mover exigiria reabrir os bancos e não traria ganho sem apagar o
		// arquivo antigo com segurança, o que não dá para garantir em disco.
	}
	if keys.IPFSSalt, err = decodeHex(file.IPFSSalt, saltLength, "ipfsSalt"); err != nil {
		return nil, err
	}
	if keys.RootSalt, err = decodeHex(file.RootSalt, saltLength, "rootSalt"); err != nil {
		return nil, err
	}
	if keys.DBSalt, err = decodeHex(file.DBSalt, saltLength, "dbSalt"); err != nil {
		return nil, err
	}
	return keys, nil
}

func randomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return nil, fmt.Errorf("falha ao gerar bytes aleatórios: %w", err)
	}
	return b, nil
}

func randomHex(n int) (string, error) {
	b, err := randomBytes(n)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func decodeHex(s string, n int, name string) ([]byte, error) {
	b, err := hex.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("keys.json: campo %s inválido: %w", name, err)
	}
	if len(b) != n {
		return nil, fmt.Errorf("keys.json: campo %s deveria ter %d bytes, tem %d", name, n, len(b))
	}
	return b, nil
}
