import { Fragment, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { checkDueReminders } from './push'
import { demo, load, purgeClosed, supa, undoTask, useData, useUndo } from './store'
import type { Task } from './types'
import Login from './screens/Login'
import Welcome from './screens/Welcome'
import NewPassword from './screens/NewPassword'
import Today from './screens/Today'
import Tasks from './screens/Tasks'
import Notes from './screens/Notes'
import Projects from './screens/Projects'
import NoteEditor, { ICON, openNote, useOpenNote } from './NoteEditor'
import Capture from './screens/Capture'
import Settings from './Settings'

// SVG path data for each tab icon (24×24, drawn with strokes).
const TABS = [
  { id: 'today', label: 'Hoy', icon: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  { id: 'tasks', label: 'Tareas', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
  { id: 'notes', label: 'Notas', icon: ICON.note },
  { id: 'projects', label: 'Proyectos', icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
] as const
const GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
// Column of each tab in the bar: the third column belongs to the ＋.
const slot = (i: number) => (i < 2 ? i : i + 1)
export type Tab = (typeof TABS)[number]['id']

export default function App() {
  // undefined = still checking; null = signed out. Demo mode never needs a session.
  const [session, setSession] = useState<Session | null | undefined>(demo ? null : undefined)
  const [tab, setTab] = useState<Tab>('today')
  const [capturing, setCapturing] = useState(false)
  const [settings, setSettings] = useState(false)
  const [recovering, setRecovering] = useState(false) // opened from the «new password» email
  const [error, setError] = useState('')
  const [dueAlert, setDueAlert] = useState<Task | null>(null)
  const { loaded, profile, tasks } = useData()
  const undo = useUndo()
  const noteId = useOpenNote()

  useEffect(() => {
    if (!supa) return
    supa.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supa.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signedIn = demo || !!session
  useEffect(() => {
    if (!signedIn) { openNote(null); return }
    let last = 0
    // Old finished tasks go first, so they never show up in «Terminadas». A failed purge just waits for next time.
    const refresh = () => {
      last = Date.now()
      purgeClosed().catch(() => {}).then(load).catch((e) => setError(e.message))
    }
    refresh()
    // Back from the background (the PWA stays open for days): fresh data for the new day.
    const onShow = () => document.visibilityState === 'visible' && Date.now() - last > 30_000 && refresh()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [signedIn])

  useEffect(() => {
    if (!signedIn || !loaded) return
    const tick = () => checkDueReminders(tasks, (t) => setDueAlert(t))
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [signedIn, loaded, tasks])

  if (session === undefined) return null
  if (recovering) return <NewPassword onDone={() => setRecovering(false)} />
  if (!signedIn) return <Login />
  if (loaded && !profile) return <Welcome />

  return (
    <>
      <main className="screen">
        {/* Ajustes from every screen, always in the same corner. */}
        <div className="screen-top">
          <button className="icon-btn settings-btn" onClick={() => setSettings(true)} aria-label="Ajustes">
            <svg viewBox="0 0 24 24" aria-hidden><path d={GEAR} /></svg>
          </button>
        </div>
        {demo && <p className="banner">Modo demo: los datos se guardan solo en este navegador.</p>}
        {error && <p className="banner danger-banner">{error}</p>}
        {dueAlert && (
          <div className="banner reminder-alert" role="alert">
            <span>🔔 <strong>Recordatorio:</strong> {dueAlert.title}</span>
            <button type="button" className="ghost" onClick={() => setDueAlert(null)}>Cerrar</button>
          </div>
        )}
        {!loaded ? null : tab === 'today' ? <Today onGo={setTab} /> : tab === 'tasks' ? <Tasks /> : tab === 'notes' ? <Notes /> : <Projects />}
      </main>
      {undo && (
        <div className="undo-toast" role="status">
          <span className="undo-text">{undo.closedAs === 'hecho' ? 'Hecha' : 'Descartada'}: «{undo.title}»</span>
          <button className="undo-btn" onClick={undoTask}>Deshacer</button>
        </div>
      )}
      <nav className="dock">
        <div className="tabs">
          {/* Two tabs, the round ＋ in the middle, two tabs. The highlighted pill slides to the active tab (it skips the
              middle column). */}
          <span className="tab-indicator" style={{ transform: `translateX(${slot(TABS.findIndex((t) => t.id === tab)) * 100}%)` }} aria-hidden />
          {TABS.map((t, i) => (
            <Fragment key={t.id}>
              {i === 2 && (
                <span className="capture-slot">
                  <button className="capture-btn" onClick={() => setCapturing(true)} aria-label="Apuntar algo">
                    <svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </span>
              )}
              <button className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                <svg viewBox="0 0 24 24" aria-hidden><path d={t.icon} /></svg>
                {t.label}
              </button>
            </Fragment>
          ))}
        </div>
      </nav>
      {capturing && <Capture onClose={() => setCapturing(false)} />}
      {settings && <Settings back={TABS.find((t) => t.id === tab)!.label} onClose={() => setSettings(false)} />}
      {noteId && <NoteEditor key={noteId} id={noteId} />}
    </>
  )
}
