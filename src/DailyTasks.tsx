import { useState } from 'react'
import { byPosition, DEFAULT_DAILY, doneToday, madridDay } from './logic'
import { ICON, Icon } from './NoteEditor'
import { insert, remove, update, useData } from './store'
import Sheet from './Sheet'
import type { DailyTask, Project } from './types'

/** «Tareas diarias» on Hoy: tick them off today, tomorrow they're back. */
export default function DailyTasks() {
  const { daily_tasks, projects } = useData()
  const [editing, setEditing] = useState(false)
  const today = madridDay()
  const list = [...daily_tasks].sort(byPosition)
  const done = list.filter((d) => doneToday(d, today)).length

  return (
    <section className="group">
      <div className="group-head">
        <h2 className="group-title">Tareas diarias</h2>
        {list.length > 0 && <span className="count">{done} de {list.length} · <button className="link" onClick={() => setEditing(true)}>Editar</button></span>}
      </div>
      {list.length ? (
        <DailyGrid list={list} projects={projects} />
      ) : (
        <div className="empty-card">
          <p className="muted">Cosas que haces cada día: se tachan y mañana vuelven.</p>
          <div className="row-actions">
            <button className="secondary" onClick={() => insert('daily_tasks', DEFAULT_DAILY.map((title, position) => ({ title, position, done_on: null, project_id: null })))}>Usar ejemplos</button>
            <button className="ghost" onClick={() => setEditing(true)}>Crear las mías</button>
          </div>
        </div>
      )}
      {editing && <EditDaily list={list} projects={projects} onClose={() => setEditing(false)} />}
    </section>
  )
}

/**
 * The tick-off buttons, on Hoy and on a project's page. `projects` shows each one's project as a small label;
 * on a project's page it's left out, since they're all from that project.
 */
export function DailyGrid({ list, projects = [] }: { list: DailyTask[]; projects?: Project[] }) {
  const today = madridDay()
  return (
    <div className="daily-grid">
      {list.map((d) => {
        const on = doneToday(d, today)
        const project = projects.find((p) => p.id === d.project_id)
        return (
          <button key={d.id} className={`daily-btn ${on ? 'done' : ''}`} onClick={() => update('daily_tasks', d.id, { done_on: on ? null : today })} aria-pressed={on}>
            <span className="daily-title">{d.title}</span>
            {project && <span className="daily-tag">{project.name}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Rename, reorder, delete, add and label daily tasks. Each change is saved at once, like the task sheet. */
function EditDaily({ list, projects, onClose }: { list: DailyTask[]; projects: Project[]; onClose: () => void }) {
  const open = projects.filter((p) => p.status !== 'hecho')
  const [text, setText] = useState('')
  // Swap positions with the neighbour (positions are renumbered so equal or missing ones can't get stuck).
  const move = (i: number, by: number) => {
    const order = [...list]
    ;[order[i], order[i + by]] = [order[i + by], order[i]]
    return Promise.all(order.map((d, position) => d.position !== position && update('daily_tasks', d.id, { position })))
  }
  const add = () => {
    if (!text.trim()) return
    insert('daily_tasks', [{ title: text.trim(), position: list.length, done_on: null, project_id: null }])
    setText('')
  }

  return (
    <Sheet title="Tareas diarias" onClose={onClose}>
      <ul className="list card-list edit-daily">
        {list.map((d, i) => (
          <li key={d.id}>
            <input defaultValue={d.title} onBlur={(e) => e.target.value.trim() && e.target.value !== d.title && update('daily_tasks', d.id, { title: e.target.value.trim() })} aria-label="Nombre" />
            {open.length > 0 && (
              <select className="daily-project" value={d.project_id ?? ''} onChange={(e) => update('daily_tasks', d.id, { project_id: e.target.value || null })} aria-label={`Proyecto de «${d.title}»`}>
                <option value="">Sin proyecto</option>
                {[...open, ...projects.filter((p) => p.status === 'hecho' && p.id === d.project_id)].map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
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
    </Sheet>
  )
}
