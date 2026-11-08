import { useEffect, useState } from 'react'
import { addDays, byPriority, localDay, parseSearch, projectsTagged, taskMatchesTags, textMatches } from '../logic'
import { ICON, Icon } from '../NoteEditor'
import { KEEP_CLOSED_DAYS, useData } from '../store'
import { ClosedRow, TaskRow, TaskSheet } from '../TaskRow'
import Sheet, { Choice, ViewTabs } from '../Sheet'
import { DailyList, NewDaily } from '../DailyTasks'
import { createTask } from '../store'
import { REPEAT, type Repeat, type Status, type Task } from '../types'

const GROUPS: [Status, string][] = [['en_curso', 'En curso'], ['abierto', 'Abiertas'], ['esperando', 'Esperando']]

// Three kinds of task: one-off, every day (Hoy's checklist) and recurring (rent, investing…, each with its next date).
type View = 'puntuales' | 'diarias' | 'periodicas'
const VIEWS: Record<View, string> = { puntuales: 'Puntuales', diarias: 'Diarias', periodicas: 'Periódicas' }
// Hoy's «Ver todas» opens Tareas straight on Diarias.
let nextView: View = 'puntuales'
export const openDailyView = () => { nextView = 'diarias' }

export default function Tasks() {
  const { tasks: allOpen, closed: allClosed, projects, daily_tasks } = useData()
  const [showClosed, setShowClosed] = useState(false)
  const [view, setView] = useState<View>(() => nextView)
  useEffect(() => { nextView = 'puntuales' }, [])
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null) // the task just created, to fill in the rest
  const editingTask = allOpen.find((t) => t.id === editing)
  // «#idiomas» = tasks tagged #idiomas or in a project tagged #idiomas; words search title and details.
  const { tags, text } = parseSearch(query)
  const tagged = tags.length ? projectsTagged(projects, tags) : null
  // The project's name counts too: «alquiler» finds the tasks of the project «Alquiler».
  const matches = (t: Task) => taskMatchesTags(t, tags, tagged) && textMatches(text, t.title, t.notes, projects.find((p) => p.id === t.project_id)?.name)
  const oneOff = allOpen.filter((t) => !t.repeat)
  const recurring = allOpen.filter((t) => t.repeat)
  const tasks = oneOff.filter(matches)
  const closed = allClosed.filter(matches)
  // Periódicas: soonest first, so «what's coming up» reads top to bottom.
  const upcoming = recurring.filter(matches).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  const sorted = [...tasks].sort(byPriority)

  return (
    <>
      <div className="title-row">
        <h1 className="page-title">Tareas</h1>
        <button className="add-btn" onClick={() => setAdding(true)} aria-label={view === 'diarias' ? 'Nueva tarea diaria' : view === 'periodicas' ? 'Nueva tarea periódica' : 'Nueva tarea, sin IA'}><svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" /></svg></button>
      </div>
      <ViewTabs value={view} options={VIEWS} counts={{ puntuales: oneOff.length, diarias: daily_tasks.length, periodicas: recurring.length }} onChange={setView} />
      {view === 'diarias' ? <DailyList /> : <>
      {(view === 'periodicas' ? recurring.length > 0 : oneOff.length > 0 || allClosed.length > 0) && (
        <label className="search">
          <Icon d={ICON.search} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar, proyecto o #etiqueta" aria-label="Buscar tareas" />
          {query && <button className="ghost" onClick={() => setQuery('')} aria-label="Borrar búsqueda"><Icon d={ICON.x} /></button>}
        </label>
      )}
      {view === 'periodicas' ? (
        <>
          {!upcoming.length && <p className="empty">{query ? 'Ninguna tarea periódica coincide.' : 'Lo que vuelve cada semana, mes o año: pagar el alquiler, invertir, la cuota del gimnasio… Pulsa ＋ para añadir una.'}</p>}
          {upcoming.length > 0 && (
            <section className="group">
              <h2 className="group-title">Próximas · {upcoming.length}</h2>
              <ul className="list card-list">{upcoming.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
              <p className="hint">Al marcarla como hecha, pasa sola a su próxima fecha.</p>
            </section>
          )}
        </>
      ) : <>
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
      </>}
      {adding && (view === 'diarias'
        ? <NewDaily onClose={() => setAdding(false)} />
        : view === 'periodicas'
        ? <NewRecurring onClose={() => setAdding(false)} />
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

/** «＋» in Periódicas: what, how often and the first date; the rest (time of the alarm, project…) in its sheet. */
function NewRecurring({ onClose }: { onClose: () => void }) {
  const today = localDay()
  const [title, setTitle] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('month')
  const [day, setDay] = useState(today)
  const [busy, setBusy] = useState(false)
  const OPTIONS: Record<Repeat, string> = { week: REPEAT.week, '2weeks': REPEAT['2weeks'], month: REPEAT.month, year: REPEAT.year }
  const create = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    await createTask({ title: title.trim(), repeat, due_date: day || today })
    onClose()
  }
  return (
    <Sheet title="Nueva tarea periódica" onClose={onClose}>
      <form className="form" onSubmit={(e) => (e.preventDefault(), create())}>
        <input className="big-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pagar el alquiler, invertir…" autoFocus maxLength={500} aria-label="Título" />
        <div className="field">Se repite
          <Choice value={repeat} options={OPTIONS} onChange={setRepeat} />
        </div>
        <div className="choice">
          {([['Hoy', today], ['Mañana', addDays(today, 1)]] as const).map(([label, d]) => (
            <button type="button" key={label} className={day === d ? 'on' : ''} onClick={() => setDay(d)}>{label}</button>
          ))}
        </div>
        <label className="field">Próxima vez
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <button className="primary" disabled={!title.trim() || busy}>Crear</button>
      </form>
    </Sheet>
  )
}
