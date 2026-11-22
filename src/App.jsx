import { useEffect, useState, useRef } from 'react'
import DesktopShell from '../ui-template/src/DesktopShell'
import { Icon } from '../ui-template/src/icons'
import SidebarShortcuts from './components/Sidebar'
import { IconEval, IconSetup } from './components/icons'
import ChessistSettings from './components/ChessistSettings'
import EvaluationPage from './pages/EvaluationPage'
import SetupPage from './pages/SetupPage'
import MobileSetupPage from './pages/MobileSetupPage'
import AppsPage from './pages/AppsPage'
import AboutPage from './pages/AboutPage'
import MobileAboutPage from './pages/MobileAboutPage'
import logo from './assets/chess-topper-knight.svg'
import mobileLogo from '../logo.png'

const isMobile = window.chessist?.isMobile === true
const piecesKey = (fen) => (fen ? fen.split(' ')[0] : '')
const brand = {
  name: 'Chess Topper',
  caption: isMobile ? 'Mobile assistant' : 'Desktop analysis',
  mark: <img src={isMobile ? mobileLogo : logo} alt="" width={24} height={24} style={{ display: 'block', objectFit: 'contain' }} />,
}
const navigation = [
  { id: 'evaluation', label: 'Evaluation', icon: <IconEval aria-hidden="true" /> },
  { id: 'apps', label: 'Apps', icon: <Icon name="home" /> },
  { id: 'setup', label: 'Setup', icon: <IconSetup aria-hidden="true" /> },
  { id: 'about', label: 'About', icon: <Icon name="info" /> },
  { id: 'settings', label: 'Settings', icon: <Icon name="settings" /> },
]

const windowControls = !isMobile ? {
  minimize: () => window.chessist.minimizeWindow(),
  toggleMaximize: () => window.chessist.maximizeWindow(),
  close: () => window.chessist.closeWindow(),
  isMaximized: () => window.chessist.isWindowMaximized(),
  onMaximizedChange: callback => window.chessist.onWindowMaximizedChange(callback),
} : undefined

export default function App() {
  const [status, setStatus] = useState({
    stockfishOk: false, stockfishState: isMobile ? 'idle' : 'starting',
    overlayOk: false, extensionConnected: false, extensionUpdateAvailable: false,
    chessConnected: false, chessSite: null, message: '',
  })
  const [ev, setEv] = useState(null)
  const [autoMoveStatus, setAutoMoveStatus] = useState(null)
  const [pos, setPos] = useState(null)
  const [page, setPage] = useState('evaluation')
  const [updateStatus, setUpdateStatus] = useState(null)
  const [settings, setSettings] = useState({ game: null, engine: null })
  const [settingsError, setSettingsError] = useState('')
  const [settingsLoadError, setSettingsLoadError] = useState('')
  const [shortcutIds, setShortcutIds] = useState(null)
  const [shortcutError, setShortcutError] = useState('')
  const [overlayEnabled, setOverlayEnabled] = useState(false)
  const [currentTarget, setCurrentTarget] = useState(null)
  const [overlayPermissionNeeded, setOverlayPermissionNeeded] = useState(false)
  const settingWrites = useRef(new Map())
  const posRef = useRef(null)

  useEffect(() => {
    let mounted = true
    const api = window.chessist
    const load = (scope, read) => read().then(values => {
      if (mounted) setSettings(previous => ({ ...previous, [scope]: values }))
    }).catch(() => {
      if (mounted) setSettingsLoadError('Could not load some settings. Restart Chess Topper to try again.')
    })
    load('game', api.getGameSettings)
    load('engine', api.getEngineSettings)
    api.getSidebarShortcuts().then(ids => {
      if (mounted) setShortcutIds(ids)
    }).catch(() => {
      if (mounted) setShortcutError('Could not load shortcuts.')
    })

    if (isMobile) {
      Promise.all([api.getOverlayState(), api.getCurrentTarget()]).then(([overlay, target]) => {
        if (!mounted) return
        setOverlayEnabled(!!overlay?.enabled)
        setOverlayPermissionNeeded(!!overlay?.enabled && !overlay?.accessibilityEnabled)
        setCurrentTarget(target || null)
      }).catch(() => {})
    }
    return () => { mounted = false }
  }, [])

  async function changeSetting(scope, key, value) {
    const api = window.chessist
    const read = scope === 'game' ? api.getGameSettings : api.getEngineSettings
    const write = scope === 'game' ? api.setGameOption : api.setEngineOption
    const field = `${scope}.${key}`
    const request = Symbol(field)
    const previousValue = settings[scope]?.[key]
    const update = (nextValue) => setSettings(previous => ({
      ...previous, [scope]: { ...previous[scope], [key]: nextValue },
    }))
    settingWrites.current.set(field, request)
    setSettingsError('')
    update(value)

    try {
      const saved = await write(key, value)
      if (!saved || !Object.hasOwn(saved, key)) throw new Error('Missing saved setting')
      if (settingWrites.current.get(field) === request) update(saved[key])
    } catch {
      if (settingWrites.current.get(field) !== request) return
      const saved = await read().catch(() => null)
      if (settingWrites.current.get(field) !== request) return
      update(saved && Object.hasOwn(saved, key) ? saved[key] : previousValue)
      setSettingsError('Could not save the setting. Try again.')
    }
  }

  function changeShortcuts(ids) {
    const previousIds = shortcutIds
    setShortcutError('')
    setShortcutIds(ids)
    window.chessist.setSidebarShortcuts(ids).then(saved => {
      setShortcutIds(current => current === ids ? saved : current)
    }).catch(() => {
      setShortcutIds(current => current === ids ? previousIds : current)
      setShortcutError('Could not save shortcuts.')
    })
  }

  async function toggleOverlay() {
    if (!isMobile) return
    setSettingsError('')
    try {
      const next = !overlayEnabled
      const state = await window.chessist.setOverlayEnabled(next)
      setOverlayEnabled(!!state?.enabled)
      setOverlayPermissionNeeded(!!next && !state?.accessibilityEnabled)
      if (next && !state?.accessibilityEnabled) {
        setPage('setup')
      }
    } catch (error) {
      setSettingsError(error?.message || 'Could not change overlay state.')
    }
  }

  useEffect(() => {
    let mounted = true
    const api = window.chessist
    api.getStatus().then(value => mounted && setStatus(value))
    const offS = api.onStatus((nextStatus) => {
      setStatus(nextStatus)
      if (nextStatus.stockfishState !== 'ready') setEv(null)
      if (!nextStatus.chessConnected) setAutoMoveStatus(null)
    })
    const offP = api.onPosition?.((p) => {
      posRef.current = p
      setPos(previous => previous?.fen === p?.fen && previous?.flipped === p?.flipped ? previous : p)
    })
    const offE = api.onEval((e) => {
      const cur = posRef.current?.fen
      if (cur && e.fen && piecesKey(e.fen) !== piecesKey(cur)) return
      setEv(e)
    })
    const offMove = api.onAutoMoveStatus?.(setAutoMoveStatus)
    const offOverlay = api.onOverlayChanged?.(state => {
      setOverlayEnabled(!!state?.enabled)
      setOverlayPermissionNeeded(!!state?.enabled && !state?.accessibilityEnabled)
    })
    const offTarget = api.onTargetChanged?.(setCurrentTarget)
    if (!isMobile) api.checkUpdate?.().then(setUpdateStatus).catch(() => {})
    return () => {
      mounted = false
      offS?.(); offE?.(); offP?.(); offMove?.(); offOverlay?.(); offTarget?.()
    }
  }, [])

  const updateAvailable = !!updateStatus?.available
  const engineReady = isMobile ? overlayEnabled : status.stockfishOk && status.extensionConnected
  const currentTargetLabel = currentTarget?.label || currentTarget?.packageName || ''

  return (
    <DesktopShell brand={brand} items={navigation} page={page} onNavigate={setPage}
      windowControls={windowControls}
      sidebarTools={<SidebarShortcuts settings={settings} shortcutIds={shortcutIds} shortcutError={shortcutError}
        onSettingChange={changeSetting} onShortcutsChange={changeShortcuts} />}
      sidebarFooter={<div className="workspace">
        <span className="workspace-avatar chessist-connection" data-ready={engineReady} aria-hidden="true"><span /></span>
        <div className="workspace-copy">
          <strong>{isMobile ? (overlayEnabled ? 'Overlay enabled' : 'Overlay off') : (engineReady ? 'Ready' : 'Setup')}</strong>
          <span>{isMobile ? (currentTargetLabel || 'Choose chess apps') : (status.extensionConnected ? 'Extension connected' : 'Extension disconnected')}</span>
        </div>
      </div>}
      banner={<>
        {updateAvailable && page !== 'about' && <div className="chessist-banner">
          <span>A new version is available.</span>
          <button type="button" className="button button-primary" onClick={() => setPage('about')}>View update</button>
        </div>}
        {!isMobile && status.message && page !== 'setup' && <div className="chessist-banner chessist-banner--status">{status.message}</div>}
        {isMobile && overlayPermissionNeeded && page !== 'setup' && (
          <button type="button" className="chessist-banner mobile-permission-banner" onClick={() => setPage('setup')}>
            Allow Chess Topper accessibility access to show the floating button.
          </button>
        )}
      </>}
    >
      <div key={page} className={page === 'evaluation' ? 'chessist-evaluation' : undefined}>
        {page === 'evaluation' && <EvaluationPage ev={ev} pos={pos} status={status} gameSettings={settings.game}
          autoMoveStatus={autoMoveStatus} onOpenSetup={() => setPage('setup')}
          overlayEnabled={overlayEnabled} currentTarget={currentTarget}
          onToggleOverlay={toggleOverlay} onOpenApps={() => setPage('apps')} />}
        {page === 'apps' && <AppsPage />}
        {page === 'setup' && (isMobile
          ? <MobileSetupPage onOpenApps={() => setPage('apps')} />
          : <SetupPage status={status} />)}
        {page === 'settings' && <ChessistSettings gameSettings={settings.game} engineSettings={settings.engine}
          onGameChange={(key, value) => changeSetting('game', key, value)}
          onEngineChange={(key, value) => changeSetting('engine', key, value)}
          loadError={settingsLoadError} />}
        {page === 'about' && (isMobile
          ? <MobileAboutPage />
          : <AboutPage updateStatus={updateStatus} onUpdateStatus={setUpdateStatus} />)}
      </div>
      {settingsError && (
        <div role="alert" style={{
          position: 'fixed', right: 16, bottom: 16, zIndex: 1001, padding: '8px 12px', fontSize: 12,
          color: 'rgb(var(--status-red))', background: 'rgb(var(--bg))', border: '1px solid rgb(var(--border))',
          borderRadius: 'var(--radius-sm)',
        }}>
          {settingsError}
        </div>
      )}
    </DesktopShell>
  )
}
