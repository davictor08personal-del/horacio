import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { demo, load, supa, useData } from './store'
import Login from './screens/Login'
import Today from './screens/Today'
import Tasks from './screens/Tasks'
import Notes from './screens/Notes'
import Projects from './screens/Projects'
import NoteEditor, { ICON, useOpenNote } from './NoteEditor'
import Capture from './screens/Capture'

// SVG path data for each tab icon (24×24, drawn with strokes).
const TABS = [
  { id: 'today', label: 'Hoy', icon: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  { id: 'tasks', label: 'Tareas', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
  { id: 'notes', label: 'Notas', icon: ICON.note },
  { id: 'projects', label: 'Proyectos', icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
] as const
export type Tab = (typeof TABS)[number]['id']

export default function App() {
  // undefined = still checking; null = signed out. Demo mode never needs a session.
  const [session, setSession] = useState<Session | null | undefined>(demo ? null : undefined)
  const [tab, setTab] = useState<Tab>('today')
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')
  const { loaded } = useData()
  const noteId = useOpenNote()

  useEffect(() => {
    if (!supa) return
    supa.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supa.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const signedIn = demo || !!session
  useEffect(() => {
    if (!signedIn) return
    const refresh = () => load().catch((e) => setError(e.message))
    refresh()
    // Back from the background (the PWA stays open for days): fresh data for the new day.
    const onShow = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [signedIn])

  if (session === undefined) return null
  if (!signedIn) return <Login />

  return (
    <>
      <main className="screen">
        {demo && <p className="banner">Modo demo: los datos se guardan solo en este navegador.</p>}
        {error && <p className="banner danger-banner">{error}</p>}
        {!loaded ? null : tab === 'today' ? <Today onGo={setTab} /> : tab === 'tasks' ? <Tasks /> : tab === 'notes' ? <Notes /> : <Projects />}
      </main>
      <nav className="dock">
        <div className="tabs">
          {/* The highlighted pill slides to the active tab instead of jumping (the only animation, as in Músculo). */}
          <span className="tab-indicator" style={{ transform: `translateX(${TABS.findIndex((t) => t.id === tab) * 100}%)` }} aria-hidden />
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <svg viewBox="0 0 24 24" aria-hidden><path d={t.icon} /></svg>
              {t.label}
            </button>
          ))}
        </div>
        <button className="capture-btn" onClick={() => setCapturing(true)} aria-label="Apuntar algo">
          <svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </nav>
      {capturing && <Capture onClose={() => setCapturing(false)} />}
      {noteId && <NoteEditor key={noteId} id={noteId} />}
    </>
  )
}
