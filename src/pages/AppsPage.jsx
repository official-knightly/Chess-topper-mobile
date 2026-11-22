import { useEffect, useMemo, useState } from 'react'

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
        window.chessist.getInstalledApps(),
        window.chessist.getSelectedApps(),
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
    Promise.all([window.chessist.getInstalledApps(), window.chessist.getSelectedApps()])
      .then(([installed, chosen]) => {
        if (!active) return
        setApps(Array.isArray(installed) ? installed.filter(app => app?.packageName) : [])
        setSelected(Array.isArray(chosen) ? chosen : [])
        setError('')
      })
      .catch(failure => active && setError(failure?.message || 'Could not read installed apps. Tap Retry.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => apps.filter(app =>
    (app.label || app.appName || '').toLowerCase().includes(query.trim().toLowerCase())
  ), [apps, query])

  async function toggle(packageName) {
    const previous = selected
    const next = selected.includes(packageName)
      ? selected.filter(item => item !== packageName)
      : [...selected, packageName]
    setSelected(next)
    setSaving(true)
    setError('')
    try {
      const result = await window.chessist.setSelectedApps(next)
      if (Array.isArray(result?.packages)) setSelected(result.packages)
    } catch {
      setSelected(previous)
      setError('Could not save app selection. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content mobile-apps-page">
      <header className="page-heading">
        <h1>Chess apps</h1>
        <p>Choose the apps where the Chess Topper floating button should appear.</p>
        <button className="button button-plain" type="button" disabled={loading || refreshing} onClick={() => loadApps()}>{refreshing ? 'Refreshing…' : 'Refresh apps'}</button>
      </header>
      <section className="mobile-info-card">
        <strong>{selected.length} app{selected.length === 1 ? '' : 's'} selected</strong>
        <span>The floating button appears only while one of these apps is in the foreground.</span>
      </section>
      <label className="mobile-search">
        <span>Search installed apps</span>
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
      <p className="mobile-footnote">
        You can select almost any installed app here. Floating controls can appear above selected apps; reading a chessboard still needs a compatible board adapter for that app.
      </p>
    </div>
  )
}
