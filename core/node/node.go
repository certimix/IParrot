// Package node sobe o nó P2P do IParrot.
//
// A pilha é a mesma do Berty:
//
//	IPFS (kubo, em processo)  ->  repositório criptografado (go-ipfs-repo-encrypted / SQLCipher)
//	Wesh Protocol (weshnet)   ->  grupos, contatos e criptografia ponta a ponta sobre
//	                              go-orbit-db + go-ipfs-log (logs CRDT append-only)
//	Berty Messenger           ->  camada de aplicação: contas, contatos, conversas e mensagens
//
// O código de inicialização segue o que o próprio Berty faz em
// go/internal/initutil e go/internal/encryptedrepo, e o que o weshnet faz em
// NewPersistentServiceClient — só que com tudo gravado criptografado em disco.
package node

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	ds "github.com/ipfs/go-datastore"
	ds_sync "github.com/ipfs/go-datastore/sync"
	ipfs_cfg "github.com/ipfs/kubo/config"
	ipfs_repo "github.com/ipfs/kubo/repo"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"moul.io/zapgorm2"

	"berty.tech/berty/v2/go/pkg/bertymessenger"
	"berty.tech/berty/v2/go/pkg/messengertypes"
	encrepo "berty.tech/go-ipfs-repo-encrypted"
	"berty.tech/weshnet/v2"
	"berty.tech/weshnet/v2/pkg/ipfsutil"
	ipfs_mobile "berty.tech/weshnet/v2/pkg/ipfsutil/mobile"
	"berty.tech/weshnet/v2/pkg/protocoltypes"

	sqlite "iparrot/core/gormsqlcipher"
)

// Config descreve como subir o nó.
type Config struct {
	// DataDir é a pasta onde ficam a identidade, os bancos e o repositório IPFS.
	DataDir string

	// Logger opcional. Se nil, nada é registrado.
	Logger *zap.Logger

	// StorageKey opcional (32 bytes) vinda do cofre do sistema operacional.
	// Sem ela, uma chave é gerada e guardada em DataDir/keys.json.
	StorageKey []byte

	// RdvpMaddrs são os servidores de rendezvous (encontro de pares).
	// Vazio = o que o usuário salvou na tela de rede; sem isso, o servidor
	// público padrão do weshnet, mantido pela Berty Technologies.
	RdvpMaddrs []string

	// StaticRelays são os relays libp2p usados quando os pares estão atrás de NAT.
	// Vazio = relay público padrão do weshnet.
	StaticRelays []string
}

// Node é um nó IParrot em execução.
type Node struct {
	// Messenger é a API de alto nível (contatos, conversas, mensagens).
	Messenger messengertypes.MessengerServiceClient
	// Protocol é a API do Wesh Protocol (grupos, eventos, rede).
	Protocol protocoltypes.ProtocolServiceClient
	// Local guarda as escolhas deste aparelho que o Berty não controla
	// (conversas ocultas, contatos bloqueados).
	Local *LocalState

	// EffectiveRdvp e EffectiveRelays são os endereços que este nó está
	// realmente usando, já contando a queda do weshnet para os servidores
	// públicos do Berty. Não confunda com LocalState.Servers(), que devolve
	// só o que a pessoa gravou na tela de Rede.
	EffectiveRdvp   []string
	EffectiveRelays []string
	// UsingDefaultServers diz que pelo menos uma das listas acima veio do
	// padrão do weshnet, ou seja, depende da infraestrutura do Berty.
	UsingDefaultServers bool

	dataDir string
	logger  *zap.Logger
	closers []func() error
}

// Start sobe o nó completo. Em caso de erro, tudo que já foi aberto é fechado.
func Start(ctx context.Context, cfg Config) (_ *Node, err error) {
	if cfg.DataDir == "" {
		return nil, errors.New("DataDir não informado")
	}
	if cfg.Logger == nil {
		cfg.Logger = zap.NewNop()
	}
	logger := cfg.Logger

	if err := os.MkdirAll(cfg.DataDir, 0o700); err != nil {
		return nil, fmt.Errorf("não foi possível criar a pasta de dados: %w", err)
	}

	n := &Node{dataDir: cfg.DataDir, logger: logger}
	defer func() {
		if err != nil {
			_ = n.Close()
		}
	}()

	// O estado local vem primeiro: é dele que saem os servidores configurados.
	if n.Local, err = LoadLocalState(cfg.DataDir); err != nil {
		return nil, fmt.Errorf("estado local: %w", err)
	}
	savedRdvp, savedRelays := n.Local.Servers()
	rdvp := pick(cfg.RdvpMaddrs, savedRdvp)
	relays := pick(cfg.StaticRelays, savedRelays)

	// Lista vazia não significa "sem servidor": o weshnet cai para os
	// servidores públicos do Berty quando recebe nil — em service.go
	// (`opts.P2PRdvpMaddrs == nil` -> DefaultP2PRdvpMaddr) e em
	// pkg/ipfsutil/mobile.go (idem para PeerStorePeers e P2PStaticRelays).
	//
	// Guardamos aqui o que de fato vale, porque sem isso a tela de Rede
	// mostra "nenhum servidor configurado" enquanto o aparelho conversa com
	// a infraestrutura do Berty — e aí um problema de conexão fica
	// impossível de diagnosticar.
	n.EffectiveRdvp = rdvp
	if len(n.EffectiveRdvp) == 0 {
		n.EffectiveRdvp = []string{ipfsutil.DefaultP2PRdvpMaddr}
		n.UsingDefaultServers = true
	}
	n.EffectiveRelays = relays
	if len(n.EffectiveRelays) == 0 {
		n.EffectiveRelays = []string{ipfsutil.DefaultP2PStaticRelay}
		n.UsingDefaultServers = true
	}

	keys, err := loadOrCreateStorageKeys(cfg.DataDir, cfg.StorageKey)
	if err != nil {
		return nil, err
	}
	if keys.VaultErr != nil {
		logger.Warn("cofre do sistema indisponível: a chave ficou em keys.json", zap.Error(keys.VaultErr))
	}

	// 1) Repositório IPFS criptografado (go-ipfs-repo-encrypted).
	repoPath := filepath.Join(cfg.DataDir, "ipfs.sqlite")
	repo, err := loadEncryptedRepo(repoPath, keys.Key, keys.IPFSSalt)
	if err != nil {
		return nil, fmt.Errorf("repositório IPFS: %w", err)
	}

	// 2) Nó IPFS/libp2p em processo, com relay e rendezvous configurados.
	mrepo := ipfs_mobile.NewRepoMobile(repoPath, repo)
	mnode, err := ipfsutil.NewIPFSMobile(ctx, mrepo, &ipfsutil.MobileOptions{
		Logger:          logger.Named("ipfs"),
		P2PStaticRelays: nilIfEmpty(relays),
		PeerStorePeers:  nilIfEmpty(rdvp),
	})
	if err != nil {
		_ = repo.Close()
		return nil, fmt.Errorf("nó IPFS: %w", err)
	}
	n.closers = append(n.closers, mnode.Close)

	coreAPI, err := ipfsutil.NewExtendedCoreAPIFromNode(mnode.IpfsNode)
	if err != nil {
		return nil, fmt.Errorf("API do IPFS: %w", err)
	}

	// 3) Datastore raiz do Wesh (chaves de grupos, cache do OrbitDB), também criptografado.
	sqldsOpts := encrepo.SQLCipherDatastoreOptions{JournalMode: "WAL", PlaintextHeader: true, Salt: keys.RootSalt}
	sqlDS, err := encrepo.NewSQLCipherDatastore("sqlite3", filepath.Join(cfg.DataDir, "datastore.sqlite"), "blocks", keys.Key, sqldsOpts)
	if err != nil {
		return nil, fmt.Errorf("datastore raiz: %w", err)
	}
	var rootDS ds.Batching = ds_sync.MutexWrap(sqlDS)
	n.closers = append(n.closers, rootDS.Close)

	// 4) Wesh Protocol (weshnet): identidade, grupos e E2EE sobre OrbitDB/ipfs-log.
	wesh, err := weshnet.NewServiceClient(weshnet.Opts{
		Logger:        logger.Named("wesh"),
		IpfsCoreAPI:   coreAPI,
		Host:          mnode.PeerHost(),
		RootDatastore: rootDS,
		DatastoreDir:  cfg.DataDir,
		P2PRdvpMaddrs: nilIfEmpty(rdvp),
	})
	if err != nil {
		return nil, fmt.Errorf("protocolo Wesh: %w", err)
	}
	n.closers = append(n.closers, wesh.Close)
	n.Protocol = wesh

	// 5) Banco do mensageiro (SQLCipher via GORM) + serviço Berty Messenger.
	db, closeDB, err := openMessengerDB(filepath.Join(cfg.DataDir, "messenger.sqlite"), keys.Key, keys.DBSalt, logger)
	if err != nil {
		return nil, fmt.Errorf("banco do mensageiro: %w", err)
	}
	n.closers = append(n.closers, closeDB)

	messenger, err := bertymessenger.NewServiceClient(wesh, &bertymessenger.Opts{
		DB:     db,
		Logger: logger.Named("messenger"),
	})
	if err != nil {
		return nil, fmt.Errorf("serviço de mensagens: %w", err)
	}
	n.closers = append(n.closers, messenger.Close)
	n.Messenger = messenger

	logger.Info("nó IParrot no ar", zap.String("dataDir", cfg.DataDir))
	return n, nil
}

// DataDir devolve a pasta de dados do nó.
func (n *Node) DataDir() string { return n.dataDir }

// Close encerra o nó, na ordem inversa da inicialização.
func (n *Node) Close() error {
	var errs []error
	for i := len(n.closers) - 1; i >= 0; i-- {
		if err := n.closers[i](); err != nil {
			errs = append(errs, err)
		}
	}
	n.closers = nil
	return errors.Join(errs...)
}

// loadEncryptedRepo abre (criando se preciso) o repositório IPFS em SQLCipher.
// Adaptado de berty/go/internal/encryptedrepo.LoadEncryptedRepoFromPath (Apache-2.0/MIT).
func loadEncryptedRepo(path string, key, salt []byte) (ipfs_repo.Repo, error) {
	dir, _ := filepath.Split(path)
	if _, err := ipfsutil.LoadPlugins(dir); err != nil {
		return nil, fmt.Errorf("falha ao carregar plugins do IPFS: %w", err)
	}

	sqldsOpts := encrepo.SQLCipherDatastoreOptions{JournalMode: "WAL", PlaintextHeader: len(salt) != 0, Salt: salt}
	isInit, err := encrepo.IsInitialized(path, key, sqldsOpts)
	if err != nil {
		return nil, fmt.Errorf("falha ao verificar o repositório: %w", err)
	}
	if !isInit {
		cfg, err := ipfsutil.CreateBaseConfig()
		if err != nil {
			return nil, fmt.Errorf("falha ao criar a configuração base: %w", err)
		}
		ucfg, err := persistentConfig(cfg)
		if err != nil {
			return nil, err
		}
		if err := encrepo.Init(path, key, sqldsOpts, ucfg); err != nil {
			return nil, fmt.Errorf("falha ao inicializar o repositório: %w", err)
		}
	}

	return encrepo.Open(path, key, sqldsOpts)
}

// persistentConfig ajusta a configuração base do IPFS para um nó persistente.
// Adaptado de berty/go/internal/encryptedrepo (Apache-2.0/MIT), juntando
// upgradeToPersistentConfig com o `Spec = nil` que LoadEncryptedRepoFromPath
// aplica logo em seguida.
func persistentConfig(cfg *ipfs_cfg.Config) (*ipfs_cfg.Config, error) {
	c, err := cfg.Clone()
	if err != nil {
		return nil, err
	}

	c.Mounts = ipfs_cfg.Mounts{IPFS: "/ipfs", IPNS: "/ipns"}
	c.Ipns = ipfs_cfg.Ipns{ResolveCacheSize: 128}
	c.Provide = ipfs_cfg.Provide{
		Strategy: ipfs_cfg.NewOptionalString("all"),
		DHT: ipfs_cfg.ProvideDHT{
			Interval:     ipfs_cfg.NewOptionalDuration(time.Hour * 12),
			SweepEnabled: ipfs_cfg.False,
		},
	}
	c.Datastore = ipfs_cfg.Datastore{
		StorageMax:         "10GB",
		StorageGCWatermark: 90, // 90%
		GCPeriod:           "1h",
		BloomFilterSize:    0,
		// Spec fica nulo de propósito: quem guarda os blocos é o datastore
		// SQLCipher, não o flatfs/levelds do kubo. O Berty monta o Spec padrão
		// e depois o zera (repo.go, `ucfg.Datastore.Spec = nil`); aqui ele já
		// nasce nulo, com o mesmo efeito.
		Spec: nil,
	}
	return c, nil
}

// openMessengerDB abre o banco do mensageiro com as mesmas opções do Berty
// (berty/go/internal/accountutils.GetGormDBForPath).
func openMessengerDB(path string, key, salt []byte, logger *zap.Logger) (*gorm.DB, func() error, error) {
	args := []string{
		"_journal_mode=WAL",
		fmt.Sprintf("_pragma_key=x'%s'", hex.EncodeToString(key)),
		"_pragma_cipher_plaintext_header_size=32",
		fmt.Sprintf("_pragma_cipher_salt=x'%s'", hex.EncodeToString(salt)),
		"_pragma_cipher_page_size=4096",
	}
	dsn := path + "?" + strings.Join(args, "&")

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:                                   zapgorm2.New(logger.Named("gorm")),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, nil, fmt.Errorf("não foi possível obter a conexão do banco: %w", err)
	}
	sqlDB.SetMaxOpenConns(1)

	return db, sqlDB.Close, nil
}

// pick dá preferência ao que veio na configuração (variável de ambiente ou
// código nativo) e cai para o que o usuário salvou na tela de rede.
func pick(fromConfig, saved []string) []string {
	if len(fromConfig) > 0 {
		return fromConfig
	}
	return saved
}

func nilIfEmpty(s []string) []string {
	if len(s) == 0 {
		return nil
	}
	return s
}
