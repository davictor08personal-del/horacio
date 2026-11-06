import { useEffect, useState } from 'react'
import { byPriority, parseSearch, projectsTagged, textMatches } from '../logic'
import { ICON, Icon } from '../NoteEditor'
import { KEEP_CLOSED_DAYS, useData } from '../store'
import { ClosedRow, TaskRow, TaskSheet } from '../TaskRow'
import Sheet, { Choice } from '../Sheet'
import { DailyList, NewDaily } from '../DailyTasks'
import { createTask } from '../store'
import type { Status, Task } from '../types'

const GROUPS: [Status, string][] = [['en_curso', 'En curso'], ['abierto', 'Abiertas'], ['esperando', 'Esperando']]

type View = 'puntuales' | 'diarias'
const VIEWS: Record<View, string> = { puntuales: 'Puntuales', diarias: 'Diarias' }
// Hoy's «Ver todas» opens Tareas straight on Diarias.
let nextView: View = 'puntuales'
export const openDailyView = () => { nextView = 'diarias' }

export default function Tasks() {
  const { tasks: allOpen, closed: allClosed, projects } = useData()
  const [showClosed, setShowClosed] = useState(false)
  const [view, setView] = useState<View>(() => nextView)
  useEffect(() => { nextView = 'puntuales' }, [])
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null) // the task just created, to fill in the rest
  const editingTask = allOpen.find((t) => t.id === editing)
  // «#idiomas» = the tasks of every project tagged #idiomas; the rest of the words search title and details.
  const { tags, text } = parseSearch(query)
  const tagged = tags.length ? projectsTagged(projects, tags) : null
  const matches = (t: Task) => (!tagged || (!!t.project_id && tagged.has(t.project_id))) && textMatches(text, t.title, t.notes)
  const tasks = allOpen.filter(matches)
  const closed = allClosed.filter(matches)
  const sorted = [...tasks].sort(byPriority)

  return (
    <>
      <div className="title-row">
        <h1 className="page-title">Tareas</h1>
        <button className="add-btn" onClick={() => setAdding(true)} aria-label={view === 'diarias' ? 'Nueva tarea diaria' : 'Nueva tarea, sin IA'}><svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" /></svg></button>
      </div>
      <Choice value={view} options={VIEWS} onChange={setView} />
      {view === 'diarias' ? <DailyList /> : <>
      {(allOpen.length > 0 || allClosed.length > 0) && (
        <label className="search">
          <Icon d={ICON.search} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar o #etiqueta" aria-label="Buscar tareas" />
          {query && <button className="ghost" onClick={() => setQuery('')} aria-label="Borrar búsqueda"><Icon d={ICON.x} /></button>}
        </label>
      )}
      {!tasks.length && <p className="empty">{query ? 'Ninguna tarea abierta coincide.' : 'No hay tareas abiertas. Pulsa ＋ para apuntar algo.'}</p>}
      {GROUPS.map(([status, label]) => {
        const list = sorted.filter((t) => t.status === status)
        return list.length > 0 && (
          <section className="group" key={status}>
            <h2 className="group-title">{label} · {list.length}</h2>
            <ul className="list card-list">{list.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          </section>
        )
      })}
      {editingTask && <TaskSheet task={editingTask} onClose={() => setEditing(null)} />}
      {closed.length > 0 && (
        <section className="group">
          <button className="group-head group-toggle" onClick={() => setShowClosed(!showClosed)} aria-expanded={showClosed}>
            <h2 className="group-title">Terminadas · {closed.length}</h2>
            <span className="chev" aria-hidden>{showClosed ? '⌄' : '›'}</span>
          </button>
          {showClosed && (
            <>
              <ul className="list card-list">{closed.map((t) => <ClosedRow key={t.id} task={t} />)}</ul>
              <p className="hint">Se borran solas a los {KEEP_CLOSED_DAYS} días. Toca el círculo para reabrir una.</p>
            </>
          )}
        </section>
      )}
      </>}
      {adding && (view === 'diarias'
        ? <NewDaily onClose={() => setAdding(false)} />
        : <NewTask onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); setEditing(id) }} />)}
    </>
  )
}

/** «＋» in Tareas: just the title; then the task's own sheet opens for the date, priority, project… */
function NewTask({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    const [t] = await createTask({ title: title.trim() })
    onCreated(t.id)
  }
  return (
    <Sheet title="Nueva tarea" onClose={onClose}>
      <form className="form" onSubmit={(e) => (e.preventDefault(), create())}>
        <input className="big-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué hay que hacer?" autoFocus maxLength={500} aria-label="Título" />
        <button className="primary" disabled={!title.trim() || busy}>Crear y completar detalles</button>
      </form>
    </Sheet>
  )
}
