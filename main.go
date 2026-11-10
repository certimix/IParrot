// IParrot Desktop (Windows .exe e Linux): janela nativa (Wails) + núcleo P2P embutido.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"go.uber.org/zap"

	"iparrot/core/runtime"
	"iparrot/ui"
)

// App é o objeto exposto ao JavaScript (window.go.main.App).
type App struct {
	mu      sync.Mutex
	core    *runtime.Core
	err     error
	started chan struct{}
	logger  *zap.Logger
}

func newApp() *App {
	logger, err := zap.NewProduction()
	if err != nil {
		logger = zap.NewNop()
	}
	return &App{started: make(chan struct{}), logger: logger}
}

// startup sobe o núcleo em segundo plano para a janela abrir na hora.
func (a *App) startup(_ context.Context) {
	go func() {
		defer close(a.started)

		dir, err := dataDir()
		if err == nil {
			var core *runtime.Core
			core, err = runtime.Start(runtime.Config{DataDir: dir, Logger: a.logger})
			a.mu.Lock()
			a.core = core
			a.mu.Unlock()
		}
		a.mu.Lock()
		a.err = err
		a.mu.Unlock()
	}()
}

func (a *App) shutdown(_ context.Context) {
	<-a.started
	a.mu.Lock()
	core := a.core
	a.mu.Unlock()
	if core != nil {
		if err := core.Stop(); err != nil {
			a.logger.Warn("erro ao encerrar o núcleo", zap.Error(err))
		}
	}
	_ = a.logger.Sync()
}

// CoreInfo espera o núcleo ficar pronto e devolve {url, port, token, version}.
// É chamado pela interface logo ao abrir.
func (a *App) CoreInfo() (runtime.Info, error) {
	<-a.started
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.err != nil {
		return runtime.Info{}, a.err
	}
	return a.core.Info(), nil
}

func dataDir() (string, error) {
	if dir := os.Getenv("IPARROT_DATA_DIR"); dir != "" {
		return dir, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("não foi possível localizar a pasta de configuração do usuário: %w", err)
	}
	return filepath.Join(base, "IParrot"), nil
}

func main() {
	assets, err := ui.Dist()
	if err != nil {
		fmt.Fprintln(os.Stderr, "IParrot: interface embutida indisponível:", err)
		os.Exit(1)
	}

	app := newApp()

	err = wails.Run(&options.App{
		Title:            "IParrot",
		Width:            1120,
		Height:           760,
		MinWidth:         380,
		MinHeight:        600,
		BackgroundColour: &options.RGBA{R: 45, G: 54, B: 145, A: 255},
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind:             []interface{}{app},
		Linux:            &linux.Options{ProgramName: "iparrot"},
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "IParrot:", err)
		os.Exit(1)
	}
}
