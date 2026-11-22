import { useEffect, useMemo, useState } from 'react'

const withTimeout = (promise, label, ms = 12000) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
])
const CHESS_PACKAGES = new Set([
  'com.chess',
  'org.lichess.mobileV2',
  'com.chesskid',
  'com.chessclub.android',
  'com.chess24',
])

export default function AppsPage() {
  const [apps, setApps] = useState([])
  const [selected, setSelected] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function loadApps(showSpinner = true) {
    if (showSpinner) setRefreshing(true)
    setError('')
    try {
      const [installed, chosen] = await Promise.all([
        withTimeout(window.chessist.getInstalledApps(), 'Android took too long to return installed apps. Reopen the app and retry.'),
        withTimeout(window.chessist.getSelectedApps(), 'Could not read your saved app selection. Retry.'),
      ])
      setApps(Array.isArray(installed) ? installed.filter(app => app?.packageName) : [])
      setSelected(Array.isArray(chosen) ? chosen : [])
    } catch (failure) {
      setError(failure?.message || 'Could not read installed apps. Check permissions and try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      withTimeout(window.chessist.getInstalledApps(), 'Android app discovery timed out. Tap Retry.'),
      withTimeout(window.chessist.getSelectedApps(), 'Saved app selection timed out. Tap Retry.'),
    ]).then(([installed, chosen]) => {
      if (!active) return
      setApps(Array.isArray(installed) ? installed.filter(app => app?.packageName) : [])
      setSelected(Array.isArray(chosen) ? chosen : [])
      setError('')
    }).catch(failure => {
      if (active) setError(failure?.message || 'Could not read installed apps. Tap Retry.')
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => apps.filter(app =>
    (app.label || app.appName || '').toLowerCase().includes(query.trim().toLowerCase())
  ), [apps, query])

  async function saveSelection(next) {
    if (saving) return
    const previous = selected
    const unique = [...new Set(next)]
    setSelected(unique)
    setSaving(true)
    setError('')
    try {
      const result = await withTimeout(window.chessist.setSelectedApps(unique), 'Saving the app selection timed out. Please retry.')
      if (Array.isArray(result?.packages)) setSelected(result.packages)
    } catch (failure) {
      setSelected(previous)
      setError(failure?.message || 'Could not save app selection. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function toggle(packageName) {
    const next = selected.includes(packageName)
      ? selected.filter(item => item !== packageName)
      : [...selected, packageName]
    saveSelection(next)
  }

  function selectChessApps() {
    const installedChessApps = apps.filter(app => CHESS_PACKAGES.has(app.packageName)).map(app => app.packageName)
    if (!installedChessApps.length) {
      setError('No supported chess apps were found. Search the installed-app list and select one manually.')
      return
    }
    saveSelection([...selected, ...installedChessApps])
  }

  return (
    <div className="page-content mobile-apps-page">
      <header className="page-heading">
        <h1>Chess apps</h1>
        <p>Choose the apps where the Chess Topper floating button should appear.</p>
        <div className="mobile-setup-actions">
          <button className="button button-plain" type="button" disabled={loading || refreshing || saving} onClick={() => loadApps()}>
            {refreshing ? 'Refreshing…' : 'Refresh apps'}
          </button>
          <button className="button button-primary" type="button" disabled={loading || saving || !apps.length} onClick={selectChessApps}>
            Select chess apps
          </button>
        </div>
      </header>
      <section className="mobile-info-card">
        <strong>{selected.length} app{selected.length === 1 ? '' : 's'} selected</strong>
        <span>The floating button appears only while one of these apps is in the foreground. Selection is saved on this device.</span>
      </section>
      <label className="mobile-search">
        <span>Search installed apps ({apps.length})</span>
        <input value={query} onChange={event => setQuery(event.target.value)}
          type="search" placeholder="Chess.com, Lichess…" />
      </label>
      {loading && <p className="mobile-muted" role="status">Loading installed apps…</p>}
      {!loading && error && <button className="button button-plain" type="button" onClick={() => loadApps()}>Retry loading apps</button>}
      {!loading && !error && !filtered.length && <p className="mobile-muted">No matching launchable apps were found. Try refreshing the list.</p>}
      <div className="mobile-app-list">
        {filtered.map(app => {
          const packageName = app.packageName
          const checked = selected.includes(packageName)
          return (
            <label className="mobile-app-row" key={packageName}>
              <span className="mobile-app-icon" aria-hidden="true">{(app.label || app.appName || 'A').slice(0, 1).toUpperCase()}</span>
              <span className="mobile-app-copy">
                <strong>{app.label || app.appName}</strong>
                <small>{packageName}</small>
              </span>
              <input type="checkbox" checked={checked} disabled={saving}
                onChange={() => toggle(packageName)} />
            </label>
          )
        })}
      </div>
      {error && <p className="mobile-error" role="alert">{error}</p>}
      {saving && <p className="mobile-muted" role="status">Saving selected apps…</p>}
      <p className="mobile-footnote">
        The Android accessibility service detects the foreground app and displays the floating controls. It does not read the chessboard or inject moves; live board analysis requires a dedicated adapter for each chess app.
      </p>
    </div>
  )
}
