import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { celebrate } from './celebrate'
import { byPosition, DEFAULT_DAILY, doneToday, localDay, notePreview, weekOf, weeklyStreak } from './logic'
import { ICON, Icon, openNote } from './NoteEditor'
import { IconPicker, ItemIcon } from './ItemIcon'
import { insert, noteFromDaily, remove, toggleDaily, update, useData } from './store'
import Sheet from './Sheet'
import { DAILY_COLORS, type DailyTask } from './types'

/** «Tareas diarias» on Hoy: hold one to tick it for today (tomorrow it's back), tap it to open its page. */
export default function DailyTasks() {
  const { daily_tasks } = useData()
  const [editing, setEditing] = useState(false)
  const today = localDay()
  const list = [...daily_tasks].sort(byPosition)
  const done = list.filter((d) => doneToday(d, today)).length

  return (
    <section className="group">
      <div className="group-head">
        <h2 className="group-title">Tareas diarias</h2>
        {list.length > 0 && <span className="count">{done} de {list.length} · <button className="link" onClick={() => setEditing(true)}>Editar</button></span>}
      </div>
      {list.length ? (
        <>
          <DailyGrid list={list} showProject />
          <p className="hint">Mantén pulsada una para marcarla · tócala para ver su ficha.</p>
        </>
      ) : (
        <div className="empty-card">
          <p className="muted">Cosas que haces cada día: se marcan y mañana vuelven.</p>
          <div className="row-actions">
            <button className="secondary" onClick={() => insert('daily_tasks', DEFAULT_DAILY.map((title, position) => ({ title, position, done_on: null, project_id: null, description: null, icon: null, note_id: null, color: 'none' })))}>Usar ejemplos</button>
            <button className="ghost" onClick={() => setEditing(true)}>Crear las mías</button>
          </div>
        </div>
      )}
      {editing && <EditDaily list={list} onClose={() => setEditing(false)} />}
    </section>
  )
}

/** The tiles, on Hoy and on a project's page (there without the project label: they're all from it). */
export function DailyGrid({ list, showProject }: { list: DailyTask[]; showProject?: boolean }) {
  const { projects, daily_log } = useData()
  const [open, setOpen] = useState<string | null>(null)
  const today = localDay()
  const openDaily = list.find((d) => d.id === open)
  return (
    <>
      <div className="daily-grid">
        {list.map((d) => (
          <DailyTile key={d.id} d={d} today={today} onOpen={() => setOpen(d.id)}
            project={showProject ? projects.find((p) => p.id === d.project_id)?.name : undefined}
            streak={weeklyStreak(daily_log.filter((l) => l.daily_id === d.id).map((l) => l.day), today)} />
        ))}
      </div>
      {openDaily && <DailySheet daily={openDaily} onClose={() => setOpen(null)} />}
    </>
  )
}

const HOLD_MS = 600 // long enough not to fire while scrolling, short enough not to feel slow

/**
 * Tap = open its page. Hold = tick (or untick) for today: the tile sinks a little and a wash sweeps across it from
 * left to right; when it reaches the end it's done, a check pops in and confetti flies. Lifting early or scrolling
 * cancels it. The new state shows at once (optimistic) instead of waiting for the server, so nothing flickers.
 */
function DailyTile({ d, today, project, streak, onOpen }: { d: DailyTask; today: string; project?: string; streak: number; onOpen: () => void }) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  useEffect(() => setOptimistic(null), [d.done_on]) // the saved state arrived
  const on = optimistic ?? doneToday(d, today)
  const [pressing, setPressing] = useState(false)
  const timer = useRef(0)
  const held = useRef(false) // the hold already ticked it: the click that follows must not open the page
  const tile = useRef<HTMLButtonElement>(null)

  const start = (e: PointerEvent) => {
    if (e.button !== 0) return
    held.current = false
    setPressing(true)
    timer.current = window.setTimeout(() => {
      held.current = true
      setPressing(false)
      const next = !on
      setOptimistic(next)
      navigator.vibrate?.(next ? [10, 40, 18] : 10)
      if (next) celebrate(tile.current)
      toggleDaily(d, today).catch(() => setOptimistic(null))
    }, HOLD_MS)
  }
  const cancel = () => { clearTimeout(timer.current); setPressing(false) }
  const color = d.color && d.color !== 'none' ? d.color : null

  return (
    <button
      ref={tile}
      className={`daily-btn ${color ? `colored dc-${color}` : ''} ${on ? 'done' : ''} ${pressing ? 'pressing' : ''}`}
      onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onClick={() => (held.current ? (held.current = false) : onOpen())}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${d.title}${on ? ', hecha hoy' : ''}. Abrir ficha; mantén pulsado para marcarla`}
    >
      <span className="daily-fill" aria-hidden />
      {d.icon && <ItemIcon icon={d.icon} name={d.title} small />}
      <span className="daily-text">
        <span className="daily-title">{d.title}</span>
        {(project || streak > 0) && (
          <span className="daily-meta">
            {project && <span className="daily-tag">{project}</span>}
            {streak > 0 && <span className="streak" title={`${streak} ${streak === 1 ? 'semana' : 'semanas'} seguidas`}>🔥 {streak}</span>}
          </span>
        )}
      </span>
      <span className="daily-check" aria-hidden><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
    </button>
  )
}

const WEEK_LETTERS = 'LMXJVSD'

/** A daily task's page: name, picture, streak and this week, description, project and its note. Saved at once. */
function DailySheet({ daily, onClose }: { daily: DailyTask; onClose: () => void }) {
  const { projects, notes, daily_log } = useData()
  const today = localDay()
  const set = (patch: Partial<DailyTask>) => update('daily_tasks', daily.id, patch)
  const days = daily_log.filter((l) => l.daily_id === daily.id).map((l) => l.day)
  const streak = weeklyStreak(days, today)
  const note = notes.find((n) => n.id === daily.note_id)
  const on = doneToday(daily, today)
  // The note follows its daily task into the new project, so both show up there.
  const setProject = (project_id: string | null) => {
    set({ project_id })
    if (note) update('notes', note.id, { project_id })
  }
  const goToNote = (id: string) => { onClose(); openNote(id) }

  return (
    <Sheet title="Tarea diaria" onClose={onClose}>
      <div className="daily-head">
        <ItemIcon icon={daily.icon} name={daily.title} big />
        <input className="big-input" defaultValue={daily.title} onBlur={(e) => e.target.value.trim() && e.target.value !== daily.title && set({ title: e.target.value.trim() })} aria-label="Nombre" />
      </div>

      <div className="streak-card">
        <div className="streak-text">
          <strong>🔥 {streak} {streak === 1 ? 'semana' : 'semanas'}</strong>
          <span className="muted small-text">{streak ? 'seguidas haciéndola al menos un día' : 'Hazla un día esta semana para empezar la racha'}</span>
        </div>
        <div className="week-dots" aria-label="Esta semana">
          {weekOf(today).map((d, i) => (
            <span key={d} className={`week-dot ${days.includes(d) ? 'on' : ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}`}>{WEEK_LETTERS[i]}</span>
          ))}
        </div>
      </div>
      <button className={on ? 'secondary' : 'primary'} onClick={() => toggleDaily(daily, today)}>{on ? 'Hecha hoy · Desmarcar' : 'Marcar como hecha hoy'}</button>

      <label className="field">Descripción
        <textarea rows={2} placeholder="Para qué la haces, cómo, cuánto rato…" defaultValue={daily.description ?? ''} onBlur={(e) => e.target.value !== (daily.description ?? '') && set({ description: e.target.value.trim() || null })} />
      </label>

      <label className="field">Proyecto
        <select value={daily.project_id ?? ''} onChange={(e) => setProject(e.target.value || null)}>
          <option value="">Ninguno</option>
          {projects.filter((p) => p.status !== 'hecho' || p.id === daily.project_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <div className="field">Nota
        {note ? (
          <button className="note-link" onClick={() => goToNote(note.id)}>
            <Icon d={ICON.note} />
            <span className="note-link-text">
              <span className="task-title">{note.title.trim() || 'Nota'}</span>
              {notePreview(note) && <span className="task-sub">{notePreview(note)}</span>}
            </span>
            <span className="chev" aria-hidden>›</span>
          </button>
        ) : (
          <button className="secondary" onClick={() => noteFromDaily(daily).then((n) => goToNote(n.id))}>Añadir una nota</button>
        )}
        <span className="hint">La nota sale también en Notas y en el proyecto.</span>
      </div>

      <div className="field">Color
        <div className="color-picker">
          {Object.entries(DAILY_COLORS).map(([key, label]) => (
            <button key={key} type="button" className={`swatch dc-${key} ${(daily.color || 'none') === key ? 'on' : ''}`} onClick={() => set({ color: key })} aria-label={label} title={label} />
          ))}
        </div>
        <span className="hint">Con color, en Hoy sale con ese fondo y letras blancas.</span>
      </div>

      <IconPicker icon={daily.icon} onChange={(icon) => set({ icon })} label="Imagen (opcional)" />

      <button className="ghost danger" onClick={() => confirm(`¿Borrar «${daily.title}»? Se pierde su racha; su nota se queda.`) && remove('daily_tasks', daily.id).then(onClose)}>Borrar tarea diaria</button>
    </Sheet>
  )
}

/** Rename, reorder, delete and add daily tasks. Each change is saved at once, like the task sheet. */
function EditDaily({ list, onClose }: { list: DailyTask[]; onClose: () => void }) {
  const [text, setText] = useState('')
  // Swap positions with the neighbour (positions are renumbered so equal or missing ones can't get stuck).
  const move = (i: number, by: number) => {
    const order = [...list]
    ;[order[i], order[i + by]] = [order[i + by], order[i]]
    return Promise.all(order.map((d, position) => d.position !== position && update('daily_tasks', d.id, { position })))
  }
  const add = () => {
    if (!text.trim()) return
    insert('daily_tasks', [{ title: text.trim(), position: list.length, done_on: null, project_id: null, description: null, icon: null, note_id: null, color: 'none' }])
    setText('')
  }

  return (
    <Sheet title="Tareas diarias" onClose={onClose}>
      <ul className="list card-list edit-daily">
        {list.map((d, i) => (
          <li key={d.id}>
            <input defaultValue={d.title} onBlur={(e) => e.target.value.trim() && e.target.value !== d.title && update('daily_tasks', d.id, { title: e.target.value.trim() })} aria-label="Nombre" />
            <button className="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
            <button className="ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
            <button className="ghost danger" onClick={() => remove('daily_tasks', d.id)} aria-label={`Quitar «${d.title}»`}><Icon d={ICON.x} /></button>
          </li>
        ))}
      </ul>
      <form className="add-row" onSubmit={(e) => (e.preventDefault(), add())}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nueva tarea diaria" aria-label="Nueva tarea diaria" />
        <button className="secondary" disabled={!text.trim()}>Añadir</button>
      </form>
      <p className="hint">El proyecto, la imagen, la descripción y la nota se ponen en la ficha de cada una (tócala en Hoy).</p>
    </Sheet>
  )
}
