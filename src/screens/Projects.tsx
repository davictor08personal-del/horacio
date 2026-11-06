import { useState } from 'react'
import { IconPicker, ItemIcon } from '../ItemIcon'
import { byEdited, byPosition, dailyOfNote, byPriority, fold, notePreview, noteTime } from '../logic'
import { ICON, Icon, openNote } from '../NoteEditor'
import Page from '../Page'
import Sheet, { Choice } from '../Sheet'
import { DailyGrid } from '../DailyTasks'
import { createNote, createTask, insert, remove, update, useData } from '../store'
import { TaskRow } from '../TaskRow'
import { PROJECT_STATUS, type Project, type ProjectStatus } from '../types'

const GROUPS: [ProjectStatus, string][] = [['activo', 'Activos'], ['pausado', 'Pausados'], ['hecho', 'Terminados']]

/** Tab «Proyectos»: every project in one place; open one to see its description, reminders, tasks and notes. */
export default function Projects() {
  const { projects, tasks, notes, daily_tasks } = useData()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const project = projects.find((p) => p.id === open)
  // One box to search and to create: it filters by name (ignoring accents and case); if no project is called
  // exactly that, Enter (or the «Crear» row) creates it and opens it.
  const q = fold(query.trim())
  const shown = q ? projects.filter((p) => fold(p.name).includes(q)) : projects
  const exact = q ? projects.find((p) => fold(p.name.trim()) === q) : undefined

  const submit = async () => {
    if (!q) return
    if (exact) return setOpen(exact.id)
    const [created] = await insert('projects', [{ name: query.trim(), status: 'activo', description: null, icon: null, next_step: null, area: null }])
    setQuery('')
    setOpen(created.id)
  }

  return (
    <>
      <h1 className="page-title">Proyectos</h1>
      <form onSubmit={(e) => (e.preventDefault(), submit())}>
        <label className="search">
          <Icon d={ICON.search} />
          <input type="search" enterKeyHint="go" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar o crear un proyecto" aria-label="Buscar o crear un proyecto" />
        </label>
      </form>
      {q && !exact && (
        <button className="create-row" onClick={submit}>
          <span className="create-plus" aria-hidden>＋</span>
          <span>Crear el proyecto «{query.trim()}»</span>
        </button>
      )}
      {!projects.length && !q && <p className="empty">Escribe arriba el nombre de lo que tienes entre manos (la mudanza, un curso, una app…) y pulsa Intro para crearlo.</p>}
      {q && !shown.length && <p className="empty">Ningún proyecto se llama así.</p>}
      {GROUPS.map(([status, label]) => {
        const list = shown.filter((p) => p.status === status)
        return list.length > 0 && (
          <section className="group" key={status}>
            <h2 className="group-title">{label} · {list.length}</h2>
            <ul className="list card-list">
              {list.map((p) => {
                const count = tasks.filter((t) => t.project_id === p.id).length
                const noteCount = notes.filter((n) => n.project_id === p.id && !n.archived).length
                const dailyCount = daily_tasks.filter((d) => d.project_id === p.id).length
                return (
                  <li key={p.id}>
                    <button className="project" onClick={() => setOpen(p.id)}>
                      <ItemIcon icon={p.icon} name={p.name} />
                      <span className="project-text">
                      <span className="task-title">{p.name}</span>
                      <span className="task-sub">{[p.description || (p.next_step ? `Siguiente: ${p.next_step}` : null), count && `${count} ${count === 1 ? 'pendiente' : 'pendientes'}`, noteCount && `${noteCount} ${noteCount === 1 ? 'nota' : 'notas'}`, dailyCount && `${dailyCount} ${dailyCount === 1 ? 'diaria' : 'diarias'}`].filter(Boolean).join(' · ') || 'Vacío por ahora'}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {project && <ProjectPage project={project} onBack={() => setOpen(null)} />}
    </>
  )
}

/**
 * One project: its description, then what's pending (reminders = tasks with a time, then the rest) and its notes.
 * New ones made here already belong to it.
 */
function ProjectPage({ project, onBack }: { project: Project; onBack: () => void }) {
  const { tasks, notes, daily_tasks } = useData()
  const daily = daily_tasks.filter((d) => d.project_id === project.id).sort(byPosition)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const own = tasks.filter((t) => t.project_id === project.id).sort(byPriority)
  const reminders = own.filter((t) => t.due_time)
  const todo = own.filter((t) => !t.due_time)
  const ownNotes = notes.filter((n) => n.project_id === project.id && !n.archived).sort(byEdited)

  const addTask = () => {
    if (!text.trim()) return
    createTask({ title: text.trim(), project_id: project.id })
    setText('')
  }

  return (
    <Page back="Proyectos" onBack={onBack} actions={<button className="link" onClick={() => setEditing(true)}>Editar</button>}>
      <header className="today-head">
        <ItemIcon icon={project.icon} name={project.name} big />
        <h1>{project.name}</h1>
        <p className="day-line">{PROJECT_STATUS[project.status]}{project.area && ` · ${project.area}`}</p>
        {project.description
          ? <p className="butler project-desc">{project.description}</p>
          : <button className="link" onClick={() => setEditing(true)}>Añadir una descripción</button>}
        {project.next_step && <p className="next-step">Siguiente paso: {project.next_step}</p>}
      </header>

      {daily.length > 0 && (
        <section className="group">
          <h2 className="group-title">Tareas diarias · {daily.length}</h2>
          <DailyGrid list={daily} />
        </section>
      )}

      {reminders.length > 0 && (
        <section className="group">
          <h2 className="group-title">Recordatorios · {reminders.length}</h2>
          <ul className="list card-list">{reminders.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
        </section>
      )}

      <section className="group">
        <h2 className="group-title">Tareas{todo.length > 0 && ` · ${todo.length}`}</h2>
        {todo.length > 0 && <ul className="list card-list">{todo.map((t) => <TaskRow key={t.id} task={t} />)}</ul>}
        <form className="add-row" onSubmit={(e) => (e.preventDefault(), addTask())}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nueva tarea" aria-label="Nueva tarea" />
          <button className="secondary" disabled={!text.trim()}>Añadir</button>
        </form>
      </section>

      <section className="group">
        <div className="group-head">
          <h2 className="group-title">Notas{ownNotes.length > 0 && ` · ${ownNotes.length}`}</h2>
          <button className="link" onClick={() => createNote({ project_id: project.id }).then((n) => openNote(n.id))}>Nueva nota</button>
        </div>
        {ownNotes.length ? (
          <ul className="list card-list">
            {ownNotes.map((n) => (
              <li key={n.id}>
                <button className="note-row" onClick={() => openNote(n.id)}>
                  {n.color !== 'none' && <span className={`dot c-${n.color}`} aria-hidden />}
                  <span className="note-row-text">
                    <span className="task-title">{n.title.trim() || notePreview(n) || 'Nota nueva'}</span>
                    <span className="task-sub">{dailyOfNote(daily_tasks, n.id) && <span className="daily-note-tag">Nota de tarea diaria · {dailyOfNote(daily_tasks, n.id)!.title}</span>}<span className="note-time">{noteTime(n.updated_at)}</span> {n.title.trim() && notePreview(n)}</span>
                  </span>
                  <Icon d={ICON.note} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Sin notas en este proyecto.</p>
        )}
      </section>

      {editing && <ProjectSheet project={project} onClose={() => setEditing(false)} onDeleted={onBack} />}
    </Page>
  )
}

function ProjectSheet({ project, onClose, onDeleted }: { project: Project; onClose: () => void; onDeleted: () => void }) {
  const set = (patch: Partial<Project>) => update('projects', project.id, patch)
  return (
    <Sheet title="Proyecto" onClose={onClose}>
      <input className="big-input" defaultValue={project.name} onBlur={(e) => e.target.value.trim() && e.target.value !== project.name && set({ name: e.target.value.trim() })} aria-label="Nombre" />
      <IconPicker icon={project.icon} onChange={(icon) => set({ icon })} />
      <div className="field">Estado
        <Choice value={project.status} options={PROJECT_STATUS} onChange={(status) => set({ status })} />
      </div>
      <label className="field">Descripción
        <textarea rows={3} placeholder="De qué va, en una o dos frases" defaultValue={project.description ?? ''} onBlur={(e) => e.target.value !== (project.description ?? '') && set({ description: e.target.value.trim() || null })} />
      </label>
      <label className="field">Siguiente paso
        <textarea rows={2} defaultValue={project.next_step ?? ''} onBlur={(e) => e.target.value !== (project.next_step ?? '') && set({ next_step: e.target.value.trim() || null })} />
      </label>
      <label className="field">Área
        <input defaultValue={project.area ?? ''} onBlur={(e) => e.target.value !== (project.area ?? '') && set({ area: e.target.value.trim() || null })} />
      </label>
      <button className="ghost danger" onClick={() => confirm('¿Borrar este proyecto? Sus tareas y notas se quedan, sin proyecto.') && remove('projects', project.id).then(onClose).then(onDeleted)}>Borrar proyecto</button>
    </Sheet>
  )
}
