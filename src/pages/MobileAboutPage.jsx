import wordmark from '../assets/chess-topper-wordmark.png'

export default function MobileAboutPage() {
  return (
    <div className="page-content mobile-about-page">
      <img src={wordmark} alt="Chess Topper" />
      <header className="page-heading">
        <h1>About</h1>
        <p>Chess Topper for Android</p>
      </header>
      <p>Chess Topper Mobile keeps the familiar evaluation and settings interface and adds a floating control window that can appear over apps you select.</p>
      <p className="mobile-footnote">Android overlay and foreground-app detection are being built first. Chessboard reading and live analysis adapters will be added app by app.</p>
      <a href="https://github.com/official-knightly/Chess-topper-mobile" target="_blank" rel="noreferrer">Mobile repository</a>
      <a href="https://github.com/official-knightly/Chess-topper-app-" target="_blank" rel="noreferrer">Desktop repository</a>
    </div>
  )
}
