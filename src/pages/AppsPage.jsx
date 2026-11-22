import { useEffect, useMemo, useState } from 'react'

export default function AppsPage() {
  const [apps, setApps] = useState([])
  const [selected, setSelected] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([window.chessist.getInstalledApps(), window.chessist.getSelectedApps()])
      .then(([installed, chosen]) => {
        if (!active) return
        setApps(Array.isArray(installed) ? installed : [])
        setSelected(Array.isArray(chosen) ? chosen : [])
      })
      .catch(() => active && setError('Could not read installed apps. Open this page again to retry.'))
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
      {!loading && !filtered.length && <p className="mobile-muted">No matching launchable apps were found.</p>}
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
