import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('artsheet')) {
  // Dev only: every procedural texture in one labeled grid, for visual review.
  void import('./game/art/artSheetPage').then(({ mountArtSheet }) => mountArtSheet(root))
} else {
  // Offline play: install / update the service worker quietly in the background.
  registerSW({ immediate: true })

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
