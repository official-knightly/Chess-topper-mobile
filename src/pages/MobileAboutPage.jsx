import { useState } from 'react'
import wordmark from '../assets/chess-topper-wordmark.png'

export default function MobileAboutPage({ updateStatus, onUpdateStatus }) {
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)

  async function check() {
    setChecking(true)
    try {
      const result = await window.chessist.checkUpdate()
      onUpdateStatus?.(result)
    } catch (error) {
      onUpdateStatus?.({ error: error?.message || 'Could not check for updates. Check your internet connection.' })
    } finally {
      setChecking(false)
    }
  }

  async function install() {
    setInstalling(true)
    try {
      const result = await window.chessist.applyUpdate(updateStatus)
      if (!result?.ok) throw new Error(result?.error || 'Could not open the APK download.')
    } catch (error) {
      onUpdateStatus?.({ ...updateStatus, error: error?.message || 'Could not open the APK download.' })
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="page-content mobile-about-page">
      <img src={wordmark} alt="Chess Topper" />
      <header className="page-heading">
        <h1>About</h1>
        <p>Chess Topper for Android</p>
      </header>
      <section className="mobile-info-card">
        <strong>App updates</strong>
        <span>Check GitHub for the latest Android APK. Updates are downloaded and installed with Android's normal package installer.</span>
        {updateStatus?.available
          ? <p className="mobile-update-available">Version {updateStatus.latestVersion} is ready to download.</p>
          : updateStatus?.checkedAt
            ? <p className="mobile-muted">You're up to date · Checked {new Date(updateStatus.checkedAt).toLocaleString()}</p>
            : <p className="mobile-muted">{updateStatus?.error || 'Update status has not been checked yet.'}</p>}
        {updateStatus?.error && <p className="mobile-error" role="alert">{updateStatus.error}</p>}
        <div className="mobile-setup-actions">
          <button className="button button-plain" type="button" disabled={checking} onClick={check}>
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          {updateStatus?.available && <button className="button button-primary" type="button" disabled={installing} onClick={install}>
            {installing ? 'Opening download…' : 'Download update'}
          </button>}
        </div>
      </section>
      <p>Chess Topper Mobile keeps the familiar evaluation and settings interface and adds a floating control window that can appear over apps you select.</p>
      <p className="mobile-footnote">The overlay is for training boards, puzzles, self-play and post-game review. Live game engine assistance is not supported.</p>
      <a href="https://github.com/official-knightly/Chess-topper-mobile" target="_blank" rel="noreferrer">Mobile repository</a>
    </div>
  )
}
