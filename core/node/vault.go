package node

// Cofre do sistema para a chave que criptografa os bancos do IParrot.
//
// Cada sistema tem o seu, e nenhum deles precisa de dependência externa:
//
//	Windows  DPAPI (crypt32.dll), amarrado à conta do usuário
//	macOS    Keychain, pelo utilitário `security`
//	Linux    Secret Service (GNOME Keyring, KWallet), pelo `secret-tool`
//
// Quando o cofre não está disponível — servidor sem sessão gráfica, libsecret
// não instalado — o IParrot volta a guardar a chave em keys.json e avisa no
// log. No Android e no iOS nada disso é usado: lá a chave vem do Keystore ou
// do Keychain pelo código nativo, já pronta, em Config.StorageKey.

const (
	vaultService = "IParrot"
	vaultAccount = "storage-key"
)

// vaultGet devolve a chave guardada no cofre do sistema.
// Devolve (nil, nil) quando não há nada guardado, e erro quando o cofre existe
// mas não respondeu.
func vaultGet() ([]byte, error) { return vaultGetOS() }

// vaultSet guarda a chave no cofre do sistema.
func vaultSet(key []byte) error { return vaultSetOS(key) }

// vaultAvailable diz se há um cofre utilizável neste sistema.
func vaultAvailable() bool { return vaultAvailableOS() }
