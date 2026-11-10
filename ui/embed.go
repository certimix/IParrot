// Package ui embute a interface compilada (ui/dist) nos binários Go.
package ui

import (
	"embed"
	"fmt"
	"io/fs"
)

//go:embed all:dist
var dist embed.FS

// Dist devolve os arquivos da interface com "index.html" na raiz.
//
// Antes do primeiro `make ui` a pasta embutida tem só um marcador, e nesse caso
// Dist devolve um erro em vez de servir uma página em branco.
func Dist() (fs.FS, error) {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		return nil, err
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil, fmt.Errorf("interface não compilada: rode `make ui` (%w)", err)
	}
	return sub, nil
}
