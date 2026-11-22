import { Capacitor, registerPlugin } from '@capacitor/core'

const Native = registerPlugin('ChessTopperMobile')
const isNative = Capacitor.isNativePlatform()
const noop = () => () => {}
const defaultGame = { enabled:true, depth:18, showBestMove:false, showOpponentBestMove:false, showAltArrows:false, autoMove:false, instantMove:false, autoMoveDelayMin:0.1, autoMoveDelayMax:0.3, renderMode:'overlay', playerColor:'auto', showMoveIcon:false, smartTiming:true, autoRematch:false, autoNewGame:false, stealthMode:true, wlBalance:false, maxConsecutiveWins:2, maxConsecutiveLosses:3, throwRandom:false, lossRandom:false, targetAccuracy:100 }
const defaultEngine = { skillLevel:20, limitStrength:false, elo:1500, threads:2, hash:256 }
let localGame = { ...defaultGame }
let localEngine = { ...defaultEngine }
let localShortcuts = ['engine.elo','game.depth']
let localApps = ['com.chess','org.lichess.mobileV2']
let localOverlayEnabled = false

async function call(method, options = {}) {
  if (!isNative || typeof Native[method] !== 'function') throw new Error('This feature is available in the installed Android app.')
  return Native[method](options)
}
async function getInstalledApps() {
  if (!isNative) return [{ label:'Chess.com',packageName:'com.chess' },{ label:'Lichess',packageName:'org.lichess.mobileV2' }]
  const result = await call('getInstalledApps')
  return Array.isArray(result?.apps) ? result.apps : []
}
async function getSelectedApps() {
  if (!isNative) return [...localApps]
  const result = await call('getSelectedApps')
  return Array.isArray(result?.packages) ? result.packages : []
}
async function setSelectedApps(packages) {
  if (!isNative) { localApps = [...new Set(packages)]; return { packages:localApps } }
  return call('setSelectedApps',{ packages })
}
async function getCurrentTarget() {
  if (!isNative) return null
  const result = await call('getCurrentTarget')
  return result?.target ?? null
}
async function getOverlayState() {
  if (!isNative) return { enabled:localOverlayEnabled,accessibilityEnabled:false }
  return call('getOverlayState')
}
async function setOverlayEnabled(enabled) {
  if (!isNative) { localOverlayEnabled = !!enabled; return { enabled:localOverlayEnabled,accessibilityEnabled:false } }
  return call('setOverlayEnabled',{ enabled })
}
async function readSetting(scope) {
  if (!isNative) return { ...(scope === 'game' ? localGame : localEngine) }
  return call(scope === 'game' ? 'getGameSettings' : 'getEngineSettings')
}
async function writeSetting(scope,key,value) {
  if (!isNative) { const target=scope==='game'?localGame:localEngine; target[key]=value; return { ...target } }
  return call(scope==='game'?'setGameOption':'setEngineOption',{key,value})
}
async function getShortcuts() {
  if (!isNative) return [...localShortcuts]
  const result=await call('getSidebarShortcuts')
  return Array.isArray(result?.ids)?result.ids:[]
}
async function setShortcuts(ids) {
  if (!isNative) { localShortcuts=[...new Set(ids)]; return [...localShortcuts] }
  const result=await call('setSidebarShortcuts',{ids})
  return Array.isArray(result?.ids)?result.ids:ids
}
const listen = event => callback => {
  if (!isNative) return noop()
  let handle, removed=false
  Native.addListener(event,callback).then(value=>{handle=value;if(removed)handle.remove()}).catch(()=>{})
  return ()=>{removed=true;handle?.remove?.()}
}

window.chessist = {
  isDesktop:false,isMobile:true,platform:Capacitor.getPlatform(),
  getStatus:()=>isNative?call('getStatus'):Promise.resolve({stockfishOk:false,stockfishState:'idle',overlayOk:localOverlayEnabled,extensionConnected:false,extensionUpdateAvailable:false,chessConnected:false,chessSite:null,message:''}),
  getGameSettings:()=>readSetting('game'),
  setGameOption:(key,value)=>writeSetting('game',key,value),
  getEngineSettings:()=>readSetting('engine'),
  setEngineOption:(key,value)=>writeSetting('engine',key,value),
  getSidebarShortcuts:getShortcuts,
  setSidebarShortcuts:setShortcuts,
  getInstalledApps,
  getSelectedApps,
  setSelectedApps,
  getOverlayState,
  setOverlayEnabled,
  toggleOverlay:async()=>setOverlayEnabled(!(await getOverlayState()).enabled),
  isAccessibilityEnabled:async()=>(await getOverlayState()).accessibilityEnabled,
  openAccessibilitySettings:()=>call('openAccessibilitySettings'),
  getCurrentTarget,
  getDiagnosticsStatus:async()=>({enabled:false}),
  setDiagnosticsEnabled:async()=>({enabled:false}),
  exportDiagnostics:async()=>({saved:false}),
  runPerformanceCheck:async()=>{throw new Error('Performance check is not available on Android yet.')},
  finishPerformanceFrame:()=>{},
  onPerformancePhase:noop,
  onPerformanceFrame:noop,
  onPosition:listen('position'),
  onEval:listen('evaluation'),
  onAutoMoveStatus:listen('autoMoveStatus'),
  onStatus:listen('status'),
  onOverlayChanged:listen('overlayChanged'),
  onTargetChanged:listen('targetChanged'),
  onUpdateLog:noop,
  checkUpdate:async()=>{
    const response = await fetch('https://api.github.com/repos/official-knightly/Chess-topper-mobile/releases/tags/mobile-latest', {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(response.status === 404 ? 'No Android release has been published yet.' : 'Could not check for Android updates.')
    const release = await response.json()
    const asset = (release.assets || []).find(item => /\\.apk$/i.test(item.name))
    const latestVersion = String(release.tag_name || release.name || '').replace(/^mobile-v?/i, '').replace(/^v/i, '')
    const currentVersion = '1.0.0'
    const parts = value => (value.match(/\\d+/g) || ['0']).map(Number)
    const a = parts(latestVersion), c = parts(currentVersion)
    let newer = false
    for (let i = 0; i < Math.max(a.length, c.length); i++) {
      if ((a[i] || 0) !== (c[i] || 0)) { newer = (a[i] || 0) > (c[i] || 0); break }
    }
    return {
      available: newer && !!asset,
      currentVersion,
      latestVersion,
      releaseName: release.name || 'Chess Topper Mobile update',
      notes: release.body || '',
      publishedAt: release.published_at || null,
      downloadUrl: asset?.browser_download_url || release.html_url,
      releaseUrl: release.html_url,
      assetName: asset?.name || null,
      checkedAt: new Date().toISOString(),
    }
  },
  applyUpdate:async status=>{
    const url = status?.downloadUrl || status?.releaseUrl
    if (!url) return { ok:false, error:'No Android update download is available.' }
    if (isNative) await call('openExternal',{url})
    else window.open(url,'_blank','noopener,noreferrer')
    return { ok:true, opened:true }
  },
  getBeta:async()=>false,
  setBeta:async()=>false,
  toggleDevTools:async()=>false,
  openExternal:async url=>{if(!url)return;if(isNative)return call('openExternal',{url});window.open(url,'_blank','noopener,noreferrer')},
  copyText:async text=>{if(isNative)return call('copyText',{text:String(text)});if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(String(text))},
  getExtensionPath:async()=>'',
  getFirefoxPath:async()=>'',
  revealExtensionFolder:async()=>{},
  revealFirefoxFolder:async()=>{},
  redownloadStockfish:async()=>{throw new Error('Android engine setup is not available yet.')},
  minimizeWindow:()=>{},
  maximizeWindow:()=>{},
  closeWindow:()=>{},
  isWindowMaximized:async()=>false,
  onWindowMaximizedChange:noop,
}
