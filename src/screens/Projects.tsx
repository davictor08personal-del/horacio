import { useState } from 'react'
import { IconPicker, ItemIcon } from '../ItemIcon'
import { allTags, byEdited, byPosition, cleanTag, dailyOfNote, byPriority, fold, MAX_TAGS, notePreview, noteTime, parseSearch, projectsTagged, textMatches } from '../logic'
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
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const project = projects.find((p) => p.id === open)
  // One box to search and to create: it filters by name (ignoring accents and case); if no project is called
  // exactly that, Enter (or the «Crear» row) creates it and opens it.
  // «#idiomas» finds the projects with that tag; plain words search names and tags.
  const { tags, text } = parseSearch(query)
  const tagged = projectsTagged(projects, tags)
  const shown = projects.filter((p) => tagged.has(p.id) && textMatches(text, p.name, ...(p.tags ?? [])))
  const q = fold(query.trim())
  const exact = q ? projects.find((p) => fold(p.name.trim()) === q) : undefined
  const canCreate = !!text && !tags.length && !exact

  const submit = async () => {
    if (!q) return
    if (exact) return setOpen(exact.id)
    if (!canCreate) return shown.length === 1 && setOpen(shown[0].id)
    const [created] = await insert('projects', [{ name: query.trim(), status: 'activo', description: null, icon: null, tags: [], next_step: null, area: null }])
    setQuery('')
    setOpen(created.id)
  }

  return (
    <>
      <div className="title-row">
        <h1 className="page-title">Proyectos</h1>
        <button className="add-btn" onClick={() => setAdding(true)} aria-label="Nuevo proyecto"><svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" /></svg></button>
      </div>
      <form onSubmit={(e) => (e.preventDefault(), submit())}>
        <label className="search">
          <Icon d={ICON.search} />
          <input type="search" enterKeyHint="go" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar, #etiqueta o crear un proyecto" aria-label="Buscar, #etiqueta o crear un proyecto" />
        </label>
      </form>
      {canCreate && (
        <button className="create-row" onClick={submit}>
          <span className="create-plus" aria-hidden>＋</span>
          <span>Crear el proyecto «{query.trim()}»</span>
        </button>
      )}
      {!projects.length && !q && <p className="empty">Escribe arriba el nombre de lo que tienes entre manos (la mudanza, un curso, una app…) y pulsa Intro para crearlo.</p>}
      {q && !shown.length && <p className="empty">{tags.length ? 'Ningún proyecto tiene esa etiqueta.' : 'Ningún proyecto se llama así.'}</p>}
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
                        <TagChips tags={p.tags} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {adding && <NewProject onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); setOpen(id) }} />}
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
        <TagChips tags={project.tags} />
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
                    <span className="task-sub">{dailyOfNote(daily_tasks, n.id) && <span className="daily-note-tag">Nota de tarea diaria · {dailyOfNote(daily_tasks, n.id)!.title}</span>}<span className="note-time">{noteTime(n.updated_at)}</span></span>
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

/** «＋» in Proyectos: the name, then the project opens to add the rest. */
function NewProject({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const [p] = await insert('projects', [{ name: name.trim(), status: 'activo', description: null, icon: null, tags: [], next_step: null, area: null }])
    onCreated(p.id)
  }
  return (
    <Sheet title="Nuevo proyecto" onClose={onClose}>
      <form className="form" onSubmit={(e) => (e.preventDefault(), create())}>
        <input className="big-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del proyecto" autoFocus maxLength={200} aria-label="Nombre" />
        <button className="primary" disabled={!name.trim() || busy}>Crear</button>
      </form>
    </Sheet>
  )
}

/** The project's tags as small «#tag» chips. */
export function TagChips({ tags }: { tags?: string[] | null }) {
  return tags?.length ? <span className="tags">{tags.map((t) => <span key={t} className="tag">#{t}</span>)}</span> : null
}

/** Add tags (Enter or comma), remove them with a tap, or reuse one from other projects. Saved at once. */
function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { projects } = useData()
  const [text, setText] = useState('')
  const others = allTags(projects).filter((t) => !tags.includes(t))
  const full = tags.length >= MAX_TAGS
  const add = (raw: string) => {
    const t = cleanTag(raw)
    if (t && !tags.includes(t) && !full) onChange([...tags, t])
    setText('')
  }
  return (
    <div className="field">Etiquetas
      {tags.length > 0 && (
        <span className="tags">
          {tags.map((t) => <button key={t} type="button" className="tag removable" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Quitar #${t}`}>#{t} <span aria-hidden>×</span></button>)}
        </span>
      )}
      {!full && (
        <input value={text} placeholder="#idiomas" enterKeyHint="done" autoCapitalize="none"
          onChange={(e) => (/,$/.test(e.target.value) ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text) } }}
          onBlur={() => text.trim() && add(text)} aria-label="Nueva etiqueta" />
      )}
      {others.length > 0 && !full && (
        <span className="tags">
          <span className="muted small-text">Usar:</span>
          {others.map((t) => <button key={t} type="button" className="tag suggest" onClick={() => add(t)}>#{t}</button>)}
        </span>
      )}
      <span className="hint">Una etiqueta sirve para varios proyectos. Luego busca #etiqueta en Proyectos, Notas o Tareas para verlo todo junto.</span>
    </div>
  )
}

function ProjectSheet({ project, onClose, onDeleted }: { project: Project; onClose: () => void; onDeleted: () => void }) {
  const set = (patch: Partial<Project>) => update('projects', project.id, patch)
  return (
    <Sheet title="Proyecto" onClose={onClose}>
      <input className="big-input" defaultValue={project.name} onBlur={(e) => e.target.value.trim() && e.target.value !== project.name && set({ name: e.target.value.trim() })} aria-label="Nombre" />
      <IconPicker icon={project.icon} onChange={(icon) => set({ icon })} />
      <TagEditor tags={project.tags ?? []} onChange={(tags) => set({ tags })} />
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
