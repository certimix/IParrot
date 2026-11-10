import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const MARKER = `Esta pasta recebe a interface compilada (\`make ui\`).

O arquivo existe para que //go:embed all:dist em ui/embed.go encontre algo
antes do primeiro build da interface — sem ele, go mod tidy, go build e
go test falham com "no matching files found".

Recriado automaticamente pelo vite.config.ts: o Vite esvazia a pasta a cada
build e levaria o marcador junto.
`

/** Mantém o marcador do go:embed vivo depois de cada build. */
function keepEmbedMarker(outDir: string): Plugin {
	return {
		name: 'iparrot-keep-embed-marker',
		closeBundle() {
			writeFileSync(join(outDir, '.gitkeep'), MARKER)
		},
	}
}

// `--mode single` gera um único index.html com tudo embutido (prévia/demonstração).
export default defineConfig(({ mode }) => {
	const outDir = mode === 'single' ? 'dist-single' : 'dist'
	return {
		// Caminhos relativos: a mesma build roda em wails://, capacitor://, file e http.
		base: './',
		plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : []), keepEmbedMarker(outDir)],
		build: {
			outDir,
			target: 'es2020',
			chunkSizeWarningLimit: 900,
		},
		server: { port: 5173, strictPort: true },
	}
})
