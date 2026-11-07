import { useState } from 'react'
import { addDays, colorKey, googleCalendarUrl, hhmm, localDay, mondayOf, relDay, splitToday, tintStyle } from './logic'
import { ensureNotifications, notificationState } from './push'
import { noteFromTask, remove, setTaskStatus, update, useData } from './store'
import { ColorPicker } from './ColorPicker'
import { ConfirmDelete } from './HoldDelete'
import { ICON, Icon, openNote } from './NoteEditor'
import { TagChips, TagEditor } from './screens/Projects'
import Sheet, { Choice } from './Sheet'
import { EFFORT, PRIORITY, STATUS, type Status, type Task } from './types'

/** One task: round check to finish it, tap the text to edit it. `n` numbers it (the order on Hoy). */
export function TaskRow({ task: initialTask, n, deletable }: { task: Task; n?: number; deletable?: boolean }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Ticking it: the check fills and the row slides away first, then it's saved (and leaves the list) — no jump.
  const [leaving, setLeaving] = useState(false)
  const finish = () => {
    if (leaving) return
    setLeaving(true)
    navigator.vibrate?.(10)
    setTimeout(() => setTaskStatus(task, 'hecho').catch(() => setLeaving(false)), 520)
  }
  const { tasks, projects, notes } = useData()
  const task = tasks.find((t) => t.id === initialTask.id) ?? initialTask
  const today = localDay()
  const project = projects.find((p) => p.id === task.project_id)
  const note = notes.find((n) => n.id === task.note_id)
  const color = colorKey(task.color)
  const hasReminder = !!(task.due_date && task.due_time)
  const late = task.due_date && task.due_date < today
  const sub = [
    task.due_date && `${hasReminder ? '🔔 ' : ''}${relDay(task.due_date, today)}`,
    task.due_time && hhmm(task.due_time),
    task.status === 'en_curso' && 'En curso',
    task.status === 'esperando' && 'Esperando',
    project?.name,
    note && 'Con nota',
  ].filter(Boolean).join(' · ')

  return (
    <li style={tintStyle(task.color)} className={`task ${color ? `colored dc-${color}` : ''} ${leaving ? 'leaving' : ''}`}>
      {n && <span className="num" aria-hidden>{n}</span>}
      <button className={`tick prio-${task.priority}`} onClick={finish} aria-label={`Marcar «${task.title}» como hecha`} />
      <button className="task-text" onClick={() => setOpen(true)}>
        <span className="task-title">{task.title}</span>
        {sub && <span className={`task-sub ${late ? 'late' : ''}`}>{sub}</span>}
        <TagChips tags={task.tags} />
      </button>
      {deletable && <button className="row-del" onClick={() => setDeleting(true)} aria-label={`Borrar «${task.title}»`}><Icon d={ICON.trash} /></button>}
      {open && <TaskSheet task={task} onClose={() => setOpen(false)} />}
      {deleting && <ConfirmDelete title={task.title} onConfirm={() => remove('tasks', task.id)} onClose={() => setDeleting(false)} />}
    </li>
  )
}

/** A finished or discarded task in «Terminadas»: the filled check reopens it. */
export function ClosedRow({ task: initialTask }: { task: Task }) {
  const { closed, projects } = useData()
  const task = closed.find((t) => t.id === initialTask.id) ?? initialTask
  const project = projects.find((p) => p.id === task.project_id)
  const when = task.done_at ? relDay(localDay(new Date(task.done_at)), localDay()).toLowerCase() : ''
  const color = colorKey(task.color)
  return (
    <li style={tintStyle(task.color)} className={`task closed ${color ? `colored dc-${color}` : ''}`}>
      <button className={`tick ${task.status === 'hecho' ? 'done' : 'dropped'}`} onClick={() => setTaskStatus(task, 'abierto')} aria-label={`Reabrir «${task.title}»`} />
      <div className="task-text">
        <span className="task-title">{task.title}</span>
        <span className="task-sub">{[`${STATUS[task.status]} ${when}`, project?.name].filter(Boolean).join(' · ')}</span>
        <TagChips tags={task.tags} />
      </div>
    </li>
  )
}

/** Opens Google Calendar with this task as a new event (see googleCalendarUrl). */
export function CalendarLink({ task, label = 'Añadir a Google Calendar' }: { task: Pick<Task, 'title' | 'notes' | 'due_date' | 'due_time'>; label?: string }) {
  const url = googleCalendarUrl(task)
  return url ? (
    <a className="calendar-link" href={url} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" aria-hidden><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 13v4M10 15h4" /></svg>
      {label}
    </a>
  ) : null
}

const EDITABLE: Record<Exclude<Status, 'hecho' | 'descartado'>, string> = { abierto: STATUS.abierto, en_curso: STATUS.en_curso, esperando: STATUS.esperando }

const QUICK_HOURS = ['09:00', '13:00', '18:00', '21:00']

/** Every field of a task. Each change is saved at once (no "Save" button to forget). */
export function TaskSheet({ task: initialTask, onClose }: { task: Task; onClose: () => void }) {
  const { tasks, projects, notes } = useData()
  const task = tasks.find((t) => t.id === initialTask.id) ?? initialTask
  const [perm, setPerm] = useState(notificationState)
  const today = localDay()
  const nextMon = addDays(mondayOf(today), 7)
  const inFocus = splitToday(tasks).focus.some((t) => t.id === task.id)
  const note = notes.find((n) => n.id === task.note_id)
  const set = (patch: Partial<Task>) => update('tasks', task.id, patch)
  const finish = (s: Status) => setTaskStatus(task, s).then(onClose)
  const quickDays: [string, string | null][] = [['Hoy', today], ['Mañana', addDays(today, 1)], ['Próx. lunes', nextMon], ['Sin fecha', null]]
  const timeVal = hhmm(task.due_time)
  const hasReminder = !!(task.due_date && timeVal)

  const setReminderTime = (t: string | null) => {
    set(t ? { due_date: task.due_date ?? today, due_time: t } : { due_time: null })
    if (t && perm === 'default') ensureNotifications().then(() => setPerm(notificationState()))
  }

  return (
    <Sheet title="Tarea" onClose={onClose}>
      <input className="big-input" defaultValue={task.title} onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && set({ title: e.target.value.trim() })} aria-label="Título" />
      {inFocus ? (
        <p className="in-focus-badge"><span aria-hidden>☀</span> Está en tus Prioridades de hoy</p>
      ) : (
        <button type="button" className="pin-today" onClick={() => set({ due_date: today, priority: 'alta', status: 'en_curso' })}>
          <span aria-hidden>☀</span> Fijar en Prioridades de hoy
        </button>
      )}
      <div className="field">Estado
        <Choice value={task.status as keyof typeof EDITABLE} options={EDITABLE} onChange={(status) => set({ status })} />
      </div>
      <div className="field">Prioridad
        <Choice value={task.priority} options={PRIORITY} onChange={(priority) => set({ priority })} />
      </div>
      <div className="field">Esfuerzo
        <Choice value={task.effort} options={EFFORT} onChange={(effort) => set({ effort })} />
      </div>
      <div className="field">Color
        <ColorPicker value={task.color} onChange={(color) => set({ color })} />
      </div>
      <div className="reminder-box">
        <div className="reminder-head">
          <span className="reminder-title"><span aria-hidden>🔔</span> Recordatorio y fecha</span>
          {(task.due_date || timeVal) && (
            <button type="button" className="link reminder-clear" onClick={() => set({ due_date: null, due_time: null })}>Quitar</button>
          )}
        </div>
        <div className="choice">
          {quickDays.map(([label, d]) => (
            <button type="button" key={label} className={task.due_date === d ? 'on' : ''} onClick={() => set(d ? { due_date: d } : { due_date: null, due_time: null })}>{label}</button>
          ))}
        </div>
        <div className="choice">
          {QUICK_HOURS.map((h) => (
            <button type="button" key={h} className={timeVal === h ? 'on' : ''} onClick={() => setReminderTime(timeVal === h ? null : h)}>{h}</button>
          ))}
        </div>
        <div className="two-col">
          <label className="field">Fecha
            <input type="date" value={task.due_date ?? ''} onChange={(e) => set(e.target.value ? { due_date: e.target.value } : { due_date: null, due_time: null })} />
          </label>
          <label className="field">Hora del aviso
            <input type="time" value={timeVal} onChange={(e) => setReminderTime(e.target.value || null)} />
          </label>
        </div>
        {hasReminder ? (
          <p className="reminder-status on">
            🔔 Recibirás una notificación {relDay(task.due_date!, today).toLowerCase()} a las {timeVal}
          </p>
        ) : task.due_date ? (
          <p className="reminder-status">Elige una hora para recibir una notificación el {relDay(task.due_date, today).toLowerCase()}.</p>
        ) : (
          <p className="reminder-status">Elige fecha y hora para que te llegue una notificación.</p>
        )}
        {hasReminder && perm === 'default' && (
          <button type="button" className="pin-today" onClick={() => ensureNotifications().then(() => setPerm(notificationState()))}>
            🔔 Permitir notificaciones en este dispositivo
          </button>
        )}
        {hasReminder && perm === 'denied' && (
          <p className="hint danger">Tienes las notificaciones bloqueadas en el navegador o móvil. Actívalas en los ajustes del navegador para recibir el aviso.</p>
        )}
        {hasReminder && perm === 'install' && (
          <p className="hint">En iPhone, añade Cuadre a la pantalla de inicio para recibir notificaciones.</p>
        )}
      </div>
      <TagEditor tags={task.tags ?? []} onChange={(tags) => set({ tags })} />
      <div className="two-col">
        <label className="field">Proyecto
          <select value={task.project_id ?? ''} onChange={(e) => set({ project_id: e.target.value || null })}>
            <option value="">Ninguno</option>
            {projects.filter((p) => p.status !== 'hecho' || p.id === task.project_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {googleCalendarUrl(task) && <CalendarLink task={task} />}
      <label className="field">Detalles
        <textarea rows={2} defaultValue={task.notes ?? ''} onBlur={(e) => e.target.value !== (task.notes ?? '') && set({ notes: e.target.value.trim() || null })} />
      </label>
      <div className="field">Nota
        {note ? (
          <button className="linked-note" onClick={() => openNote(note.id)}>
            <span>{note.title.trim() || 'Nota sin título'}</span><span className="chev" aria-hidden>›</span>
          </button>
        ) : (
          <button className="secondary" onClick={() => noteFromTask(task).then((n) => openNote(n.id))}>Crear nota de esta tarea</button>
        )}
      </div>
      <button className="primary" onClick={() => finish('hecho')}>Hecha</button>
      <div className="row-actions">
        <button className="ghost" onClick={() => finish('descartado')}>Descartar</button>
        <button className="ghost danger" onClick={() => confirm('¿Borrar esta tarea?') && remove('tasks', task.id).then(onClose)}>Borrar</button>
      </div>
    </Sheet>
  )
}
