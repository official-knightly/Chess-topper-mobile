import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'

function SetupCard({ title, description, children }) {
  return (
    <section className="mobile-setup-card">
      <div className="mobile-setup-card-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  )
}

export default function MobileSetupPage({ onOpenApps }) {
  const [overlay, setOverlay] = useState({ enabled: false, accessibilityEnabled: false })
  const [currentTarget, setCurrentTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const [state, target] = await Promise.all([
        window.chessist.getOverlayState(),
        window.chessist.getCurrentTarget(),
      ])
      setOverlay(state || { enabled: false, accessibilityEnabled: false })
      setCurrentTarget(target || null)
    } catch {
      setError('Android overlay status is unavailable in this build.')
    }
  }

  useEffect(() => {
    refresh()
    const off = window.chessist.onOverlayChanged?.(refresh)
    const offTarget = window.chessist.onTargetChanged?.(setCurrentTarget)
    let appStateHandle
    App.addListener('appStateChange', state => {
      if (state.isActive) refresh()
    }).then(handle => { appStateHandle = handle }).catch(() => {})
    return () => {
      off?.()
      offTarget?.()
      appStateHandle?.remove()
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError('')
    try {
      const state = await window.chessist.setOverlayEnabled(true)
      setOverlay(state || { enabled: true, accessibilityEnabled: false })
      if (!state?.accessibilityEnabled) {
        setError('Turn on Chess Topper in Android Accessibility settings. Then return here.')
        await window.chessist.openAccessibilitySettings()
      }
    } catch (failure) {
      setError(failure?.message || 'Could not enable the floating overlay.')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  async function disable() {
    setBusy(true)
    setError('')
    try {
      const state = await window.chessist.setOverlayEnabled(false)
      setOverlay(state || { enabled: false, accessibilityEnabled: false })
    } catch {
      setError('Could not turn off the floating overlay.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-content mobile-setup-page">
      <header className="page-heading">
        <h1>Setup</h1>
        <p>Set up the floating Chess Topper controls for Android.</p>
      </header>
      <SetupCard title="Floating overlay" description="Show the Chess Topper knight button over the chess apps you select.">
        <div className="mobile-setup-actions">
          <span className={overlay.enabled ? 'mobile-state mobile-state--on' : 'mobile-state'}>
            {overlay.enabled ? 'Enabled' : 'Disabled'}
          </span>
          {overlay.enabled
            ? <button className="button button-plain" type="button" disabled={busy} onClick={disable}>Turn off</button>
            : <button className="button button-primary" type="button" disabled={busy} onClick={enable}>{busy ? 'Opening settings…' : 'Enable overlay'}</button>}
        </div>
      </SetupCard>
      <SetupCard title="Accessibility permission" description="Android uses an accessibility service to detect which selected app is open. This build reads only the foreground app name; it does not read screen text or tap chess moves.">
        <div className="mobile-setup-actions">
          <span className={overlay.accessibilityEnabled ? 'mobile-state mobile-state--on' : 'mobile-state'}>
            {overlay.accessibilityEnabled ? 'Allowed' : 'Not allowed'}
          </span>
          <button className="button button-plain" type="button" onClick={() => window.chessist.openAccessibilitySettings()}>
            Open Android settings
          </button>
        </div>
      </SetupCard>
      <SetupCard title="Selected apps" description="Choose Chess.com, Lichess, or any other installed app. The floating button only appears in selected apps.">
        <div className="mobile-setup-actions">
          <span className="mobile-muted">{currentTarget?.label || currentTarget?.packageName || 'No selected app active'}</span>
          <button className="button button-primary" type="button" onClick={onOpenApps}>Choose apps</button>
        </div>
      </SetupCard>
      {error && <p className="mobile-error" role="status">{error}</p>}
      <p className="mobile-footnote">This enables the floating control panel. Live board detection and engine analysis require a dedicated adapter for each chess app and are not enabled for every app yet.</p>
    </div>
  )
}
