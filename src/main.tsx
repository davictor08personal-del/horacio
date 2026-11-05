import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// Fonts bundled with the app, so they work offline: Inter for the text, Fraunces (and its italic) for Horacio's voice.
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/fraunces/wght-italic.css'
import App from './App'
import './styles.css'

// Service worker: caches the app files so it opens instantly.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
