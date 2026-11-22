import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const target = process.argv[2]
if (!['win', 'mac', 'linux'].includes(target)) throw new Error('Usage: node scripts/verify-package.mjs <win|mac|linux>')
const release = join(process.cwd(), 'release')
let resources
if (target === 'win') resources = join(release, 'win-unpacked', 'resources')
if (target === 'linux') resources = join(release, 'linux-unpacked', 'resources')
if (target === 'mac') {
  const candidates = readdirSync(release, { withFileTypes: true }).filter(entry => entry.isDirectory() && entry.name.startsWith('mac'))
  for (const candidate of candidates) {
    const folder = join(release, candidate.name)
    const app = readdirSync(folder, { withFileTypes: true }).find(entry => entry.isDirectory() && entry.name.endsWith('.app'))
    if (app) { resources = join(folder, app.name, 'Contents', 'Resources'); break }
  }
}
if (!resources || !existsSync(resources)) throw new Error(`Packaged resources folder not found for ${target}.`)
const required = ['extension/manifest.json','extension/src/background/service-worker.js','extension/src/content/content.js','extension/src/content/lichess.js','extension/src/content/worldchess.js','extension/src/content/move-observer.js','extension/src/content/content.css','extension/src/popup/popup.html','extension/src/popup/popup.js','extension/icons/icon128.png','app-icon.png','firefox/manifest.json','firefox/src/background/service-worker.js','firefox/src/content/worldchess.js']
const missing = required.filter(file => !existsSync(join(resources, file)))
if (missing.length) throw new Error(`The ${target} installer is missing bundled extension files:\n${missing.join('\n')}`)
console.log(`Verified ${target} package: complete Chromium and Firefox extensions are present in ${resources}`)
