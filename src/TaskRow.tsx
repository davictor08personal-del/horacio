import { useState } from 'react'
import { hhmm, madridDay, relDay } from './logic'
import { noteFromTask, remove, setTaskStatus, update, useData } from './store'
import { openNote } from './NoteEditor'
import Sheet, { Choice } from './Sheet'
import { EFFORT, PRIORITY, STATUS, type Status, type Task } from './types'

/** One task: round check to finish it, tap the text to edit it. `n` numbers it (Horacio's order on Hoy). */
export function TaskRow({ task, n }: { task: Task; n?: number }) {
  const [open, setOpen] = useState(false)
  const { projects, notes } = useData()
  const today = madridDay()
  const project = projects.find((p) => p.id === task.project_id)
  const note = notes.find((n) => n.id === task.note_id)
  const late = task.due_date && task.due_date < today
  const sub = [
    task.due_date && relDay(task.due_date, today),
    task.due_time && hhmm(task.due_time),
    task.status === 'en_curso' && 'En curso',
    task.status === 'esperando' && 'Esperando',
    project?.name,
    note && 'Con nota',
  ].filter(Boolean).join(' · ')

  return (
    <li className="task">
      {n && <span className="num" aria-hidden>{n}</span>}
      <button className={`tick prio-${task.priority}`} onClick={() => setTaskStatus(task, 'hecho')} aria-label={`Marcar «${task.title}» como hecha`} />
      <button className="task-text" onClick={() => setOpen(true)}>
        <span className="task-title">{task.title}</span>
        {sub && <span className={`task-sub ${late ? 'late' : ''}`}>{sub}</span>}
      </button>
      {open && <TaskSheet task={task} onClose={() => setOpen(false)} />}
    </li>
  )
}

const EDITABLE: Record<Exclude<Status, 'hecho' | 'descartado'>, string> = { abierto: STATUS.abierto, en_curso: STATUS.en_curso, esperando: STATUS.esperando }

/** Every field of a task. Each change is saved at once (no "Save" button to forget). */
function TaskSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const { projects, notes } = useData()
  const note = notes.find((n) => n.id === task.note_id)
  const set = (patch: Partial<Task>) => update('tasks', task.id, patch)
  const finish = (s: Status) => setTaskStatus(task, s).then(onClose)

  return (
    <Sheet title="Tarea" onClose={onClose}>
      <input className="big-input" defaultValue={task.title} onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && set({ title: e.target.value.trim() })} aria-label="Título" />
      <div className="field">Estado
        <Choice value={task.status as keyof typeof EDITABLE} options={EDITABLE} onChange={(status) => set({ status })} />
      </div>
      <div className="field">Prioridad
        <Choice value={task.priority} options={PRIORITY} onChange={(priority) => set({ priority })} />
      </div>
      <div className="field">Esfuerzo
        <Choice value={task.effort} options={EFFORT} onChange={(effort) => set({ effort })} />
      </div>
      <div className="two-col">
        <label className="field">Fecha límite
          <input type="date" defaultValue={task.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || null })} />
        </label>
        <label className="field">Hora
          <input type="time" defaultValue={hhmm(task.due_time)} onChange={(e) => set({ due_time: e.target.value || null })} />
        </label>
      </div>
      <div className="two-col">
        <label className="field">Área
          <input defaultValue={task.area ?? ''} placeholder="Trabajo, FP…" onBlur={(e) => e.target.value !== (task.area ?? '') && set({ area: e.target.value.trim() || null })} />
        </label>
        <label className="field">Proyecto
          <select value={task.project_id ?? ''} onChange={(e) => set({ project_id: e.target.value || null })}>
            <option value="">Ninguno</option>
            {projects.filter((p) => p.status !== 'hecho' || p.id === task.project_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
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
