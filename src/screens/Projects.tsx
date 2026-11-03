import { useState } from 'react'
import { byEdited, byPriority, notePreview, noteTime } from '../logic'
import { ICON, Icon, openNote } from '../NoteEditor'
import Page from '../Page'
import Sheet, { Choice } from '../Sheet'
import { createNote, createTask, insert, remove, update, useData } from '../store'
import { TaskRow } from '../TaskRow'
import { PROJECT_STATUS, type Project, type ProjectStatus } from '../types'

const GROUPS: [ProjectStatus, string][] = [['activo', 'Activos'], ['pausado', 'Pausados'], ['hecho', 'Terminados']]

/** Every project in one place: add them, and open one to see its tasks, reminders and notes. */
export default function Projects({ onBack }: { onBack: () => void }) {
  const { projects, tasks } = useData()
  const [name, setName] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const project = projects.find((p) => p.id === open)

  const add = () => {
    if (!name.trim()) return
    insert('projects', [{ name: name.trim(), status: 'activo', next_step: null, area: null }])
    setName('')
  }

  return (
    <Page back="Tareas" onBack={onBack}>
      <h1 className="page-title">Proyectos</h1>
      <form className="add-row" onSubmit={(e) => (e.preventDefault(), add())}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo proyecto" aria-label="Nuevo proyecto" />
        <button className="secondary" disabled={!name.trim()}>Añadir</button>
      </form>
      {!projects.length && <p className="empty">Apunta aquí todo lo que tienes entre manos: el FP, la mudanza, una app…</p>}
      {GROUPS.map(([status, label]) => {
        const list = projects.filter((p) => p.status === status)
        return list.length > 0 && (
          <section className="group" key={status}>
            <h2 className="group-title">{label} · {list.length}</h2>
            <ul className="list card-list">
              {list.map((p) => {
                const count = tasks.filter((t) => t.project_id === p.id).length
                return (
                  <li key={p.id}>
                    <button className="project" onClick={() => setOpen(p.id)}>
                      <span className="task-title">{p.name}</span>
                      <span className="task-sub">{[p.next_step ? `Siguiente: ${p.next_step}` : 'Sin siguiente paso', count && `${count} ${count === 1 ? 'tarea' : 'tareas'}`].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {project && <ProjectPage project={project} onBack={() => setOpen(null)} />}
    </Page>
  )
}

/** One project: its fields, open tasks and reminders, and notes. New ones made here already belong to it. */
function ProjectPage({ project, onBack }: { project: Project; onBack: () => void }) {
  const { tasks, notes } = useData()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const own = tasks.filter((t) => t.project_id === project.id).sort(byPriority)
  const ownNotes = notes.filter((n) => n.project_id === project.id && !n.archived).sort(byEdited)

  const addTask = () => {
    if (!text.trim()) return
    createTask({ title: text.trim(), project_id: project.id })
    setText('')
  }

  return (
    <Page back="Proyectos" onBack={onBack} actions={<button className="link" onClick={() => setEditing(true)}>Editar</button>}>
      <header className="today-head">
        <h1>{project.name}</h1>
        <p className="day-line">{PROJECT_STATUS[project.status]}{project.area && ` · ${project.area}`}</p>
        {project.next_step && <p className="next-step">Siguiente paso: {project.next_step}</p>}
      </header>

      <section className="group">
        <h2 className="group-title">Tareas y recordatorios</h2>
        {own.length > 0 && <ul className="list card-list">{own.map((t) => <TaskRow key={t.id} task={t} />)}</ul>}
        <form className="add-row" onSubmit={(e) => (e.preventDefault(), addTask())}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nueva tarea" aria-label="Nueva tarea" />
          <button className="secondary" disabled={!text.trim()}>Añadir</button>
        </form>
      </section>

      <section className="group">
        <div className="group-head">
          <h2 className="group-title">Notas</h2>
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
                    <span className="task-sub"><span className="note-time">{noteTime(n.updated_at)}</span> {n.title.trim() && notePreview(n)}</span>
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
      <div className="field">Estado
        <Choice value={project.status} options={PROJECT_STATUS} onChange={(status) => set({ status })} />
      </div>
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
