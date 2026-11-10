//go:build tools

// Package tools fixa no go.mod as ferramentas de build (gomobile),
// para que `go run golang.org/x/mobile/cmd/gomobile` use a versão certa.
package tools

import (
	_ "golang.org/x/mobile/bind"
	_ "golang.org/x/mobile/cmd/gobind"
	_ "golang.org/x/mobile/cmd/gomobile"
)
