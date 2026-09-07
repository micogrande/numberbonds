import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import { migrateLegacyScores } from './storage/migrations'

// Amelia's real high scores live under the old `number_bonds_scores` key. They
// are rescued once, before anything renders, so the very first summary screen
// she sees after this ships already knows her bests (PLAN 2.6).
//
// Outside the tree and outside React on purpose: an effect would run twice under
// StrictMode and, more importantly, would run *after* a session could already
// have recorded a result. The try/catch is the belt to safeStorage's braces —
// a migration failure must never be able to white-screen the app.
try {
  migrateLegacyScores()
} catch (error) {
  console.error('Score migration failed; continuing without it.', error)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
