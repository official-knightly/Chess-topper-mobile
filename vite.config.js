import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Stamp the build with the short commit SHA when git is available (git clones, CI
// release builds). A source-ZIP build has no git, so this is empty and the About
// page falls back to showing just the version + channel.
function gitShortSha() {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { return '' }
}

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  base: './',
  define: {
    __BUILD_SHA__: JSON.stringify(gitShortSha()),
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version),
  },
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
})
