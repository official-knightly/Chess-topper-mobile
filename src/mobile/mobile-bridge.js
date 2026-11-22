import { Capacitor, registerPlugin } from '@capacitor/core'

const Native = registerPlugin('ChessTopperMobile')
const isNative = Capacitor.isNativePlatform()
const noop = () => () => {}

async function call(method, options) {
  if (!isNative || typeof Native[method] !== 'function') {
    throw new Error('This feature is available in the Android app.')
  }
  return Native[method](options || {})
}

const listen = event => callback => {
  if (!isNative) return noop()
  let handle
  let removed = false
  Native.addListener(event, callback).then(value => {
    handle = value
    if (removed) handle.remove()
  }).catch(() => {})
  return () => {
    removed = true
    handle?.remove?.()
  }
}

window.chessist = {
  isDesktop: false,
  isMobile: true,
  platform: Capacitor.getPlatform(),
  getStatus: () => call('getStatus'),
  getGameSettings: () => call('getGameSettings'),
  setGameOption: (key, value) => call('setGameOption', { key, value }),
  getEngineSettings: () => call('getEngineSettings'),
  setEngineOption: (key, value) => call('setEngineOption', { key, value }),
  getSidebarShortcuts: () => call('getSidebarShortcuts'),
  setSidebarShortcuts: ids => call('setSidebarShortcuts', { ids }),
  getInstalledApps: () => call('getInstalledApps'),
  getSelectedApps: () => call('getSelectedApps'),
  setSelectedApps: packages => call('setSelectedApps', { packages }),
  getOverlayState: () => call('getOverlayState'),
  setOverlayEnabled: enabled => call('setOverlayEnabled', { enabled }),
  toggleOverlay: () => call('toggleOverlay'),
  isAccessibilityEnabled: () => call('isAccessibilityEnabled'),
  openAccessibilitySettings: () => call('openAccessibilitySettings'),
  getCurrentTarget: () => call('getCurrentTarget'),
  getDiagnosticsStatus: async () => ({ enabled: false }),
  setDiagnosticsEnabled: async enabled => ({ enabled: false }),
  exportDiagnostics: async () => ({ saved: false }),
  runPerformanceCheck: async () => { throw new Error('Performance check is not available on Android yet.') },
  finishPerformanceFrame: () => {},
  onPerformancePhase: noop,
  onPerformanceFrame: noop,
  onPosition: listen('position'),
  onEval: listen('evaluation'),
  onAutoMoveStatus: listen('autoMoveStatus'),
  onStatus: listen('status'),
  onOverlayChanged: listen('overlayChanged'),
  onTargetChanged: listen('targetChanged'),
  onUpdateLog: noop,
  checkUpdate: async () => ({ unsupported: true, error: 'In-app updates are not available in this mobile build.' }),
  applyUpdate: async () => ({ ok: false, error: 'Install a newer Android build to update Chess Topper.' }),
  getBeta: async () => false,
  setBeta: async () => false,
  toggleDevTools: async () => false,
  openExternal: async url => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  },
  copyText: async text => {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(String(text))
  },
  getExtensionPath: async () => '',
  getFirefoxPath: async () => '',
  revealExtensionFolder: async () => {},
  revealFirefoxFolder: async () => {},
  redownloadStockfish: async () => { throw new Error('Android engine download is not configured yet.') },
  setDiagnosticsEnabled: async () => ({ enabled: false }),
  exportDiagnostics: async () => ({ saved: false }),
  minimizeWindow: () => {},
  maximizeWindow: () => {},
  closeWindow: () => {},
  isWindowMaximized: async () => false,
  onWindowMaximizedChange: noop,
}
