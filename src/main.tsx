import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// Bricolage Grotesque for titles, bundled so it works offline (the text uses the phone's own font: SF Pro on iPhone).
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import App from './App'
import './styles.css'

// Service worker: caches the app files so it opens instantly.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
