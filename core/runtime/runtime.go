// Package runtime junta o nó P2P e o servidor da API num único "liga/desliga",
// usado igualmente pelo app desktop, pelo app móvel e pelo daemon.
package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"os"
	"strings"
	"sync"

	"go.uber.org/zap"

	"iparrot/core/api"
	"iparrot/core/node"
)

// Config é a configuração de uma instância do núcleo.
type Config struct {
	// DataDir: pasta de dados (obrigatório).
	DataDir string
	// Listen: endereço de loopback. Vazio = 127.0.0.1 em porta livre.
	Listen string
	// Token fixo opcional (útil em desenvolvimento). Vazio = aleatório.
	Token string
	// StorageKey opcional, 32 bytes, vinda do cofre do sistema.
	StorageKey []byte
	// Static: interface compilada a servir em "/". Opcional.
	Static fs.FS
	// Logger opcional.
	Logger *zap.Logger
}

// Info é o que a interface precisa para falar com o núcleo.
type Info struct {
	URL     string `json:"url"`
	Port    int    `json:"port"`
	Token   string `json:"token"`
	Version string `json:"version"`
}

// JSON devolve Info serializado (formato usado pelas pontes nativas).
func (i Info) JSON() string {
	b, _ := json.Marshal(i)
	return string(b)
}

// Core é uma instância em execução.
type Core struct {
	info   Info
	node   *node.Node
	cancel context.CancelFunc
	done   chan struct{}
	once   sync.Once
	err    error
}

// Start sobe o nó e o servidor local. Pode levar alguns segundos na primeira vez
// (criação da identidade e dos bancos).
func Start(cfg Config) (*Core, error) {
	if cfg.Logger == nil {
		cfg.Logger = zap.NewNop()
	}

	ctx, cancel := context.WithCancel(context.Background())

	n, err := node.Start(ctx, node.Config{
		DataDir:      cfg.DataDir,
		Logger:       cfg.Logger,
		StorageKey:   cfg.StorageKey,
		RdvpMaddrs:   splitEnv("IPARROT_RDVP"),
		StaticRelays: splitEnv("IPARROT_RELAYS"),
	})
	if err != nil {
		cancel()
		return nil, err
	}

	srv, err := api.New(n, api.Options{Logger: cfg.Logger.Named("api"), Token: cfg.Token, Static: cfg.Static})
	if err != nil {
		cancel()
		_ = n.Close()
		return nil, err
	}

	l, err := api.Listen(cfg.Listen)
	if err != nil {
		cancel()
		_ = n.Close()
		return nil, err
	}

	port := l.Addr().(*net.TCPAddr).Port
	c := &Core{
		info: Info{
			URL:     fmt.Sprintf("http://127.0.0.1:%d", port),
			Port:    port,
			Token:   srv.Token(),
			Version: api.Version,
		},
		node:   n,
		cancel: cancel,
		done:   make(chan struct{}),
	}

	go func() {
		defer close(c.done)
		if err := srv.Serve(ctx, l); err != nil {
			cfg.Logger.Error("servidor da API parou", zap.Error(err))
		}
	}()

	return c, nil
}

// Info devolve o endereço e o token da API local.
func (c *Core) Info() Info { return c.info }

// Stop encerra o servidor e o nó. Pode ser chamado mais de uma vez.
func (c *Core) Stop() error {
	c.once.Do(func() {
		c.cancel()
		<-c.done
		c.err = c.node.Close()
	})
	return c.err
}

// splitEnv lê uma lista separada por vírgulas de uma variável de ambiente.
func splitEnv(name string) []string {
	var out []string
	for _, v := range strings.Split(os.Getenv(name), ",") {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

// Version devolve a versão do núcleo.
func Version() string { return api.Version }
