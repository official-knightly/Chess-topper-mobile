const { app, BrowserWindow, ipcMain, Menu, shell, clipboard, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { ensureStockfish } = require('./stockfish')
const { engineSettingsDefaults } = require('./engine')
const { Overlay } = require('./overlay')
const { Bridge } = require('./wsserver')
const { PerformanceCheck } = require('./performance-check')
const { Diagnostics } = require('./diagnostics')
const updater = require('./updater')

// --prod (or CHESS_TOPPER_PROD=1) loads dist/ when running unpacked.
const forceProd = process.argv.includes('--prod') || process.env.CHESS_TOPPER_PROD === '1' || process.env.CHESSIST_PROD === '1'

// Use the Chess Topper data folder. Migrate the previous folder in place so
// existing Stockfish files and user settings remain available after upgrading.
const appDataRoot = app.getPath('appData')
const legacyUserDataPaths = [
  app.getPath('userData'),
  path.join(appDataRoot, 'chessist'),
  path.join(appDataRoot, 'Chessist'),
  path.join(appDataRoot, 'ai.chessist.local'),
]
app.setName('Chess Topper')
app.setAppUserModelId('com.officialknightly.chesstopper')
const chessTopperUserDataPath = path.join(appDataRoot, 'Chess Topper')
try {
  const primaryLegacyPath = legacyUserDataPaths.find(legacyPath =>
    path.resolve(legacyPath) !== path.resolve(chessTopperUserDataPath) && fs.existsSync(legacyPath)
  )
  if (!fs.existsSync(chessTopperUserDataPath) && primaryLegacyPath) {
    fs.renameSync(primaryLegacyPath, chessTopperUserDataPath)
  }
  fs.mkdirSync(chessTopperUserDataPath, { recursive: true })
  for (const legacyPath of legacyUserDataPaths) {
    if (path.resolve(legacyPath) !== path.resolve(chessTopperUserDataPath) && fs.existsSync(legacyPath)) {
      fs.cpSync(legacyPath, chessTopperUserDataPath, { recursive: true, force: true, errorOnExist: false })
      fs.rmSync(legacyPath, { recursive: true, force: true })
    }
  }
} catch (error) {
  console.warn('Could not migrate previous app data folder:', error.message)
}
app.setPath('userData', chessTopperUserDataPath)

// ── Chess Topper settings persistence ──
// Game/display settings owned by the app and pushed to the extension over WS.
const gameSettings = {
  enabled: true,
  depth: 18,
  showBestMove: false,
  showOpponentBestMove: false,
  showAltArrows: false,    // default: only the best-move (purple) arrow
  autoMove: false,
  instantMove: false,
  autoMoveDelayMin: 0.1,
  autoMoveDelayMax: 0.3,
  renderMode: 'overlay',   // 'overlay' | 'browser' | 'electron'
  playerColor: 'auto',     // 'auto' | 'white' | 'black'
  // ── niche / advanced ──
  showMoveIcon: false,     // move-classification icons on the board
  smartTiming: true,       // human-like auto-move timing
  autoRematch: false,
  autoNewGame: false,
  stealthMode: true,       // suppress console logs
  wlBalance: false,        // win/loss balancing
  maxConsecutiveWins: 2,
  maxConsecutiveLosses: 3,
  throwRandom: false,      // randomly throw games
  lossRandom: false,
  targetAccuracy: 100,     // target move accuracy %
}

// App-level preferences (update channel, etc.).
const appPrefs = { betaUpdates: false, sidebarShortcuts: [], diagnosticsEnabled: false }
const engineSettings = engineSettingsDefaults()

function normalizeSidebarShortcuts(ids) {
  if (!Array.isArray(ids)) return []
  const settings = { game: gameSettings, engine: engineSettings }
  return [...new Set(ids.filter(id => {
    if (typeof id !== 'string') return false
    const [scope, key, extra] = id.split('.')
    return extra === undefined && Object.hasOwn(settings, scope) && Object.hasOwn(settings[scope], key)
  }))]
}

function settingsPath() { return path.join(app.getPath('userData'), 'chess-topper-settings.json') }
function loadAll() {
  try {
    const current = settingsPath()
    if (fs.existsSync(current)) return JSON.parse(fs.readFileSync(current, 'utf8')) || {}
    const legacy = path.join(app.getPath('userData'), 'chessist-settings.json')
    if (fs.existsSync(legacy)) {
      const saved = JSON.parse(fs.readFileSync(legacy, 'utf8')) || {}
      try { fs.renameSync(legacy, current) } catch {
        try { fs.writeFileSync(current, JSON.stringify(saved, null, 2)) } catch {}
      }
      return saved
    }
    return {}
  } catch { return {} }
}
function saveAll({ engine = engineSettings, game = gameSettings } = {}) {
  const file = settingsPath()
  const temp = file + '.tmp'
  try {
    fs.writeFileSync(temp, JSON.stringify({ engine, game, app: appPrefs }, null, 2))
    fs.renameSync(temp, file)
    return true
  } catch {
    try { fs.rmSync(temp, { force: true }) } catch {}
    return false
  }
}

const componentStatus = {
  stockfishOk: false,
  stockfishState: 'starting',
  overlayOk: false,
  extensionConnected: false,   // extension installed (service worker present)
  extensionUpdateAvailable: false,
  chessConnected: false,       // a chess tab (content script) is active
  chessSite: null,             // 'Chess.com' | 'Lichess' when a chess tab is active
  wsError: null,
  message: '',
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function pushStatus(patch) {
  Object.assign(componentStatus, patch)
  sendToRenderer('status', componentStatus)
}

function updateStockfishStatus({ status, message }) {
  diagnostics.record({ event: 'engine_status', state: status })
  const ready = status === 'ready'
  pushStatus({ stockfishOk: ready, stockfishState: status, message: ready ? '' : message })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040, height: 720, minWidth: 720, minHeight: 480,
    title: 'Chess Topper', backgroundColor: '#000000',
    icon: path.join(process.resourcesPath, 'app-icon.png'),
    frame: false, titleBarStyle: 'hidden', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: false,
      backgroundThrottling: false,
    },
  })
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
  mainWindow.webContents.on('did-finish-load', () => pushStatus({}))
  mainWindow.on('maximize', () => sendToRenderer('window:maximized-change', true))
  mainWindow.on('unmaximize', () => sendToRenderer('window:maximized-change', false))
  mainWindow.on('closed', () => { mainWindow = null })
}

function startSubsystems() {
  overlay = new Overlay(isDev, process.resourcesPath, (s) => pushStatus(s))
  // Restore saved settings before first start (engine applied on uciok).
  const saved = loadAll()
  for (const key of Object.keys(engineSettings)) {
    if (Object.hasOwn(saved.engine || {}, key)) engineSettings[key] = saved.engine[key]
  }
  Object.assign(gameSettings, saved.game || {})
  Object.assign(appPrefs, saved.app || {})
  appPrefs.sidebarShortcuts = normalizeSidebarShortcuts(appPrefs.sidebarShortcuts)
  diagnostics.setEnabled(appPrefs.diagnosticsEnabled === true)
  const executable = app.isPackaged ? path.join(process.resourcesPath, 'bun-ws-worker.exe') : undefined
  bridge = new Bridge(pushStatus, {
    executable,
    game: gameSettings,
    engine: engineSettings,
    versions: {
      chromium: readExtensionVersion(extensionDir()),
      firefox: readExtensionVersion(firefoxDir()),
    },
    onPosition: (data) => sendToRenderer('position', data),
    onEval: (data) => sendToRenderer('eval', data),
    onAutoMoveStatus: (data) => {
      if (data) diagnostics.record({ event: 'move_outcome', state: data.state })
      sendToRenderer('auto-move-status', data)
    },
    onOverlay: (data) => overlay.draw(data),
    onEngineStatus: updateStockfishStatus,
    onDiagnostic: data => diagnostics.record(data),
    diagnosticsEnabled: diagnostics.enabled,
  })
  bridge.start().catch(() => {}) // The bridge reports startup failures through component status.
  overlay.start()

  prepareStockfish()
}

function prepareStockfish(redownload = false) {
  if (stockfishTask) return stockfishTask
  stockfishTask = (async () => {
    const report = (status) => bridge.broadcastStatus(status)
    try {
      const userData = app.getPath('userData')
      if (redownload) {
        report({ status: 'downloading', message: 'Stockfish: re-downloading…' })
        await bridge.killEngine()
        fs.rmSync(path.join(userData, 'stockfish.exe'), { force: true })
      }
      const sfPath = await ensureStockfish(userData, report)
      if (sfPath && !quitting) bridge.startEngine(sfPath)
    } catch (e) {
      if (!quitting) report({ status: 'error', message: `Stockfish setup failed: ${e.message}` })
    }
  })().finally(() => { stockfishTask = null })
  return stockfishTask
}

function registerIpc() {
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('status:get', () => componentStatus)
  ipcMain.handle('engine:get', () => engineSettings)
  ipcMain.handle('engine:set', (_e, { key, value }) => {
    if (!Object.hasOwn(engineSettings, key)) throw new Error('Unknown engine setting.')
    if (!saveAll({ engine: { ...engineSettings, [key]: value } })) throw new Error('Could not save engine settings.')
    engineSettings[key] = value
    bridge?.applyEngineSetting(key, value)
    return engineSettings
  })
  ipcMain.handle('game:get', () => gameSettings)
  ipcMain.handle('game:set', (_e, { key, value }) => {
    if (!Object.hasOwn(gameSettings, key)) throw new Error('Unknown game setting.')
    if (!saveAll({ game: { ...gameSettings, [key]: value } })) throw new Error('Could not save game settings.')
    gameSettings[key] = value
    bridge?.broadcastSettings(gameSettings)
    return gameSettings
  })
  ipcMain.handle('sidebar:get-shortcuts', () => appPrefs.sidebarShortcuts)
  ipcMain.handle('sidebar:set-shortcuts', (_e, ids) => {
    const previous = appPrefs.sidebarShortcuts
    appPrefs.sidebarShortcuts = normalizeSidebarShortcuts(ids)
    if (saveAll()) return appPrefs.sidebarShortcuts
    appPrefs.sidebarShortcuts = previous
    throw new Error('Could not save shortcuts.')
  })
  ipcMain.handle('stockfish:redownload', () => {
    if (performanceCheck) throw new Error('Wait for the performance check to finish.')
    return prepareStockfish(true)
  })
  ipcMain.handle('diagnostics:get', () => ({ enabled: diagnostics.enabled }))
  ipcMain.handle('diagnostics:set-enabled', (event, enabled) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || typeof enabled !== 'boolean') {
      throw new Error('Could not change diagnostics recording.')
    }
    const previous = appPrefs.diagnosticsEnabled
    appPrefs.diagnosticsEnabled = enabled
    if (!saveAll()) {
      appPrefs.diagnosticsEnabled = previous
      throw new Error('Could not save diagnostics settings.')
    }
    diagnostics.setEnabled(enabled)
    bridge?.setDiagnosticsEnabled(enabled)
    if (enabled) {
      diagnostics.record({ event: 'engine_status', state: componentStatus.stockfishState })
      diagnostics.record({ event: 'engine_settings', threads: engineSettings.threads, hash: engineSettings.hash })
    }
    return { enabled: diagnostics.enabled }
  })
  ipcMain.handle('diagnostics:export', async event => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Open Setup to export diagnostics.')
    const date = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Chess Topper diagnostics', defaultPath: `chess-topper-diagnostics-${date}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { saved: false }
    await diagnostics.export(filePath, app.getVersion())
    return { saved: true }
  })
  ipcMain.handle('performance:run', async (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('Open Setup to run a performance check.')
    if (performanceCheck) throw new Error('A performance check is already running.')
    const check = new PerformanceCheck(mainWindow, bridge)
    performanceCheck = check
    try {
      return await check.run({ skipStockfish: !!stockfishTask || componentStatus.chessConnected })
    } finally {
      performanceCheck = null
    }
  })
  ipcMain.on('performance:frame-finished', (event, id, result) => {
    performanceCheck?.finishFrame(event.sender, id, result)
  })
  ipcMain.handle('update:get-beta', () => appPrefs.betaUpdates)
  ipcMain.handle('update:set-beta', (_e, beta) => { appPrefs.betaUpdates = !!beta; saveAll(); return appPrefs.betaUpdates })
  ipcMain.handle('update:check', () => updater.checkForUpdate(appPrefs.betaUpdates))
  ipcMain.handle('update:apply', async (_event, expectedTag) => {
    if (updateInProgress) return { ok: false, error: 'An update is already in progress.' }
    updateInProgress = true
    let result
    try {
      result = await updater.applyUpdate(appPrefs.betaUpdates, (line) => sendToRenderer('update:log', line), expectedTag)
      if (result.installer) setImmediate(() => app.quit())
      else if (result.ok) setTimeout(() => { app.relaunch(); app.quit() }, 1000)
      return result
    } finally {
      if (!result?.ok) updateInProgress = false
    }
  })
  ipcMain.handle('shell:open', (_e, url) => { try { shell.openExternal(url) } catch {} })
  ipcMain.handle('extension:path', () => extensionDir())
  ipcMain.handle('extension:reveal', () => { try { return shell.openPath(extensionDir()) } catch { return '' } })
  ipcMain.handle('extension:firefox-path', () => firefoxDir())
  ipcMain.handle('extension:firefox-reveal', () => { try { return shell.openPath(firefoxDir()) } catch { return '' } })
  ipcMain.handle('clipboard:write', (_e, text) => { try { clipboard.writeText(String(text)) } catch {} })
  ipcMain.handle('app:toggle-devtools', () => {
    const wc = mainWindow?.webContents
    if (!wc || wc.isDestroyed()) return false
    if (wc.isDevToolsOpened()) { wc.closeDevTools(); return false }
    wc.openDevTools({ mode: 'detach' }); return true
  })
}

// The bundled (or repo) browser-extension folder users load unpacked.
function extensionDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'extension')
    : path.join(__dirname, '..', 'extension')
}

// The Firefox-flavored copy (build with `npm run build:firefox`; shipped in prod).
function firefoxDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'firefox')
    : path.join(__dirname, '..', 'firefox')
}

function readExtensionVersion(directory) {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')).version
  } catch {
    return null
  }
}

// Single instance: a second launch must not race for port 27301. If we can't get
// the lock, focus the existing window and quit this one.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show(); mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    await updater.clearInstallerCache()
    Menu.setApplicationMenu(null)
    registerIpc()
    createWindow()
    startSubsystems()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })
}

app.on('before-quit', (event) => {
  if (shutdownFinished) return
  event.preventDefault()
  if (quitting) return
  quitting = true
  overlay?.kill()
  Promise.resolve(bridge?.stop()).catch(error => {
    console.error('Could not stop the local service:', error)
  }).finally(() => {
    shutdownFinished = true
    app.quit()
  })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
