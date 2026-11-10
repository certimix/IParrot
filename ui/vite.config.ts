import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode single` gera um único index.html com tudo embutido (prévia/demonstração).
export default defineConfig(({ mode }) => ({
	// Caminhos relativos: a mesma build roda em wails://, capacitor://, file e http.
	base: './',
	plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
	build: {
		outDir: mode === 'single' ? 'dist-single' : 'dist',
		target: 'es2020',
		chunkSizeWarningLimit: 900,
	},
	server: { port: 5173, strictPort: true },
}))
