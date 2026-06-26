import './App.css'

function App() {
  return (
    <main className="app-shell">
      <div className="hero-card">
        <p className="eyebrow">Beta checkpoint</p>
        <h1>ATLAS</h1>
        <p className="tagline">
          Adaptive Team-strength and Lineup Analysis for Soccer
        </p>
        <p className="summary">
          This is the first React + Vite proof app on the beta branch. The old
          generators and legacy dashboard still exist in the repo while we
          migrate one piece at a time.
        </p>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Branch</span>
            <strong>beta</strong>
          </div>
          <div className="status-item">
            <span className="status-label">Stack</span>
            <strong>Vite + React + TypeScript</strong>
          </div>
          <div className="status-item">
            <span className="status-label">Next</span>
            <strong>Cloudflare build validation</strong>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
