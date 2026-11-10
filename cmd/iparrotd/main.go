// iparrotd é o núcleo do IParrot rodando sem janela: sobe o nó P2P e serve a
// interface no navegador. Útil em servidores, para desenvolvimento e em Linux
// sem ambiente gráfico compatível.
package main

import (
	"flag"
	"fmt"
	"io/fs"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"go.uber.org/zap"

	"iparrot/core/runtime"
	"iparrot/ui"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "iparrotd:", err)
		os.Exit(1)
	}
}

func run() error {
	defaultDir, err := defaultDataDir()
	if err != nil {
		return err
	}

	var (
		dataDir = flag.String("dir", defaultDir, "pasta de dados")
		listen  = flag.String("listen", "127.0.0.1:7788", "endereço de loopback da API/interface")
		token   = flag.String("token", os.Getenv("IPARROT_TOKEN"), "token fixo (padrão: aleatório)")
		noUI    = flag.Bool("no-ui", false, "não servir a interface, só a API")
		verbose = flag.Bool("v", false, "log detalhado")
	)
	flag.Parse()

	logCfg := zap.NewProductionConfig()
	logCfg.Encoding = "console"
	if *verbose {
		logCfg.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
	} else {
		logCfg.Level = zap.NewAtomicLevelAt(zap.WarnLevel)
	}
	logger, err := logCfg.Build()
	if err != nil {
		return err
	}
	defer func() { _ = logger.Sync() }()

	var static fs.FS
	if !*noUI {
		if static, err = ui.Dist(); err != nil {
			return fmt.Errorf("interface embutida indisponível (rode `make ui`): %w", err)
		}
	}

	fmt.Println("IParrot: iniciando o nó P2P…")
	core, err := runtime.Start(runtime.Config{
		DataDir: *dataDir,
		Listen:  *listen,
		Token:   *token,
		Static:  static,
		Logger:  logger,
	})
	if err != nil {
		return err
	}

	info := core.Info()
	fmt.Printf("IParrot %s no ar\n", info.Version)
	fmt.Printf("  dados:     %s\n", *dataDir)
	if static != nil {
		fmt.Printf("  interface: %s/#token=%s\n", info.URL, info.Token)
	} else {
		fmt.Printf("  API:       %s  (token: %s)\n", info.URL, info.Token)
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig

	fmt.Println("\nIParrot: encerrando…")
	return core.Stop()
}

func defaultDataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("não foi possível localizar a pasta de configuração do usuário: %w", err)
	}
	return filepath.Join(base, "IParrot"), nil
}
