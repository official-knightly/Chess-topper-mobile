// Build a complete Firefox extension folder from the Chromium source.
// The release packager copies this exact folder to resources/firefox.
import { rmSync, mkdirSync, cpSync, copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'extension')
const out = join(root, 'firefox')
const ffManifest = join(root, 'manifest.firefox.json')
const required = [
  'manifest.json',
  'src/background/service-worker.js',
  'src/content/content.js',
  'src/content/lichess.js',
  'src/content/worldchess.js',
  'src/content/move-observer.js',
  'src/content/content.css',
  'src/popup/popup.html',
  'src/popup/popup.js',
  'icons/icon128.png',
]

for (const file of required) {
  if (!existsSync(join(src, file))) {
    throw new Error(`Cannot build Firefox extension: extension/${file} is missing.`)
  }
}
if (!existsSync(ffManifest)) throw new Error('Cannot build Firefox extension: manifest.firefox.json is missing.')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(src, out, { recursive: true })
copyFileSync(ffManifest, join(out, 'manifest.json'))

const missing = required.filter(file => file !== 'manifest.json' && !existsSync(join(out, file)))
if (missing.length) throw new Error(`Firefox extension output is incomplete: ${missing.join(', ')}`)
console.log(`Firefox extension ready: ${out}`)
