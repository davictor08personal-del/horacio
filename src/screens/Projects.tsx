import { useState } from 'react'
import { ColorPicker } from '../ColorPicker'
import { IconPicker, ItemIcon } from '../ItemIcon'
import { allTags, byEdited, byPosition, cleanTag, colorKey, coverSummary, dailyOfNote, byPriority, fold, MAX_TAGS, notePreview, noteTime, noteTone, parseSearch, projectCover, projectsTagged, shortDate, textMatches, tintStyle, type CoverItem, type ProjectCover } from '../logic'
import { ICON, Icon, openNote } from '../NoteEditor'
import { useImageUrl } from '../noteImages'
import Page from '../Page'
import Sheet, { Choice } from '../Sheet'
import { DailyArt, DailyGrid, NEW_DAILY } from '../DailyTasks'
import { createNote, createTask, insert, remove, update, useData } from '../store'
import { TaskRow } from '../TaskRow'
import { PROJECT_STATUS, type Project, type ProjectStatus } from '../types'

const GROUPS: [ProjectStatus, string][] = [['activo', 'Activos'], ['pausado', 'Pausados'], ['hecho', 'Terminados']]
const PASTELS = ['tile-lilac', 'tile-peach', 'tile-blue', 'tile-pink']
/** A project without its own colour gets a pastel picked from its id, so its card and its page always match. */
const pastelOf = (id: string) => PASTELS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PASTELS.length]
const cardTone = (p: Project) => {
  const color = colorKey(p.color)
  return color ? `colored dc-${color}` : pastelOf(p.id)
}

type ProjectsView = 'tags' | 'status'
const VIEWS: Record<ProjectsView, string> = { tags: 'Por etiqueta', status: 'Por estado' }
// Per-device preference (localStorage can fail in private mode).
const VIEW_KEY = 'cuadre-projects-view'
const savedView = (): ProjectsView => { try { return localStorage.getItem(VIEW_KEY) === 'status' ? 'status' : 'tags' } catch { return 'tags' } }

/**
 * The shelves of «Por etiqueta»: each tag (the most used first) with its active and paused projects, then the ones
 * without a tag, then the finished ones together at the end.
 */
function tagShelves(projects: Project[]): [string, Project[]][] {
  const live = projects.filter((p) => p.status !== 'hecho')
  const tags = allTags(live)
  const byTag = tags
    .map((t): [string, Project[]] => [`#${t}`, live.filter((p) => p.tags?.includes(t))])
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const shelves: [string, Project[]][] = [...byTag, ['Sin etiqueta', live.filter((p) => !p.tags?.length)], ['Terminados', projects.filter((p) => p.status === 'hecho')]]
  return shelves.filter(([, list]) => list.length > 0)
}

/** Small 24×24 stroke icon matching the rest of the app: circle for task, sheet for note, repeat arrows for daily. */
function KindIcon({ kind }: { kind: CoverItem['kind'] }) {
  if (kind === 'note') return <Icon d={ICON.note} />
  if (kind === 'daily') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />
      </svg>
    )
  }
  return <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8" /></svg>
}

/** One picture from a note, as a tilted photo card of the collage (empty frame while it loads). */
function CollagePhoto({ path, i }: { path: string; i: number }) {
  const url = useImageUrl(path)
  return (
    <span className={`collage-card collage-pic i${i} ${url ? '' : 'is-missing'}`}>
      {url ? <img src={url} alt="" loading="lazy" /> : <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 16 5-5 4 4 3-3 6 6" /></svg>}
    </span>
  )
}

/**
 * Overlapping deterministic cards (up to 4): the pictures of its notes first, then glass mini-cards with its tasks,
 * notes and daily tasks; over its own photo/emoji, or 3 ghost cards when empty.
 */
function Collage({ cover, icon, big }: { cover: ProjectCover; icon: string | null; big?: boolean }) {
  const isPicture = icon?.startsWith('data:image/')
  const photos = cover.photos.slice(0, 4)
  const items = cover.items.slice(0, 4 - photos.length)
  const n = photos.length + items.length
  return (
    <span className={`collage ${big ? 'big' : ''} ${n ? `collage-n${n}` : 'collage-empty'}`}>
      {isPicture ? <img className="collage-photo" src={icon!} alt="" /> : icon ? <span className="collage-emoji" aria-hidden>{icon}</span> : null}
      {n ? (
        <>
          {photos.map((path, i) => <CollagePhoto key={`${i}-${path}`} path={path} i={i} />)}
          {items.map((item, j) => (
            <span key={`${item.kind}-${item.id}`} className={`collage-card i${photos.length + j}`}>
              <span className="collage-icon" aria-hidden><KindIcon kind={item.kind} /></span>
              <span className="collage-title">{item.title}</span>
            </span>
          ))}
        </>
      ) : (
        <span className="collage-ghosts" aria-hidden>
          <span className="collage-ghost g1" />
          <span className="collage-ghost g2" />
          <span className="collage-ghost g3" />
        </span>
      )}
    </span>
  )
}

/** Collection card: pastel tint, overlapping glass collage with ＋ button, centred name, summary and tag chips. */
function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  const { tasks, notes, daily_tasks } = useData()
  const cover = projectCover(p, { tasks, notes, daily_tasks }, 4)
  return (
    <article style={tintStyle(p.color)} className={`pcard ${cardTone(p)} ${p.status === 'pausado' ? 'paused' : ''}`}>
      <button type="button" className="pcard-body" onClick={onOpen}>
        <Collage cover={cover} icon={p.icon} />
        <span className="pcard-name">{p.name}</span>
        <span className="pcard-meta">{shortDate(cover.day)} · {coverSummary(cover)}</span>
        <TagChips tags={p.tags} />
      </button>
      <button type="button" className="pcard-add" onClick={onOpen} aria-label={`Abrir ${p.name}`}>
        <span className="pcard-add-dot" aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        </span>
      </button>
    </article>
  )
}

/** Tab «Proyectos»: every project in one place; open one to see its description, reminders, tasks and notes. */
export default function Projects() {
  const { projects } = useData()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const project = projects.find((p) => p.id === open)
  const [view, setView] = useState<ProjectsView>(savedView)
  const changeView = (v: ProjectsView) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* only a preference */ } }
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
    const [created] = await insert('projects', [{ name: query.trim(), status: 'activo', description: null, icon: null, tags: [], next_step: null, area: null, color: 'none' }])
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
      {!projects.length && !q && (
        <div className="empty-stack">
          <div className="empty-stack-art" aria-hidden>
            <span className="empty-stack-card c1" />
            <span className="empty-stack-card c2" />
            <span className="empty-stack-card c3" />
          </div>
          <h2 className="empty-stack-title">Empieza con un proyecto</h2>
          <p className="empty-stack-sub">Reúne tareas, notas y rutinas en un solo sitio</p>
          <button className="primary empty-stack-btn" onClick={() => setAdding(true)}>Crea tu primer proyecto</button>
        </div>
      )}
      {q && !shown.length && <p className="empty">{tags.length ? 'Ningún proyecto tiene esa etiqueta.' : 'Ningún proyecto se llama así.'}</p>}
      {projects.length > 0 && !q && <Choice value={view} options={VIEWS} onChange={changeView} />}
      {view === 'tags' && !q
        ? tagShelves(projects).map(([label, list]) => (
            // One shelf per tag: its projects in a row that scrolls sideways. A project with two tags is on both.
            <section className="group" key={label}>
              <div className="group-head">
                <h2 className="group-title">{label}</h2>
                <span className="count">{list.length} {list.length === 1 ? 'proyecto' : 'proyectos'}</span>
              </div>
              <ul className="list project-shelf">{list.map((p) => <li key={p.id}><ProjectCard p={p} onOpen={() => setOpen(p.id)} /></li>)}</ul>
            </section>
          ))
        : GROUPS.map(([status, label]) => {
            const list = shown.filter((p) => p.status === status)
            return list.length > 0 && (
              <section className="group" key={status}>
                <h2 className="group-title">{label} · {list.length}</h2>
                {/* Full-width collection cards stacked in one column. */}
                <ul className="list project-grid">{list.map((p) => <li key={p.id}><ProjectCard p={p} onOpen={() => setOpen(p.id)} /></li>)}</ul>
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
function ProjectPage({ project: initialProject, onBack }: { project: Project; onBack: () => void }) {
  const { projects, tasks, notes, daily_tasks } = useData()
  const project = projects.find((p) => p.id === initialProject.id) ?? initialProject
  const daily = daily_tasks.filter((d) => d.project_id === project.id).sort(byPosition)
  const [text, setText] = useState('')
  const [kind, setKind] = useState<'puntual' | 'diaria'>('puntual')
  const [editing, setEditing] = useState(false)
  const [writingDesc, setWritingDesc] = useState(false)
  const own = tasks.filter((t) => t.project_id === project.id).sort(byPriority)
  const reminders = own.filter((t) => t.due_time)
  const todo = own.filter((t) => !t.due_time)
  const ownNotes = notes.filter((n) => n.project_id === project.id && !n.archived).sort(byEdited)

  const addTask = () => {
    if (!text.trim()) return
    // «Diaria» = a daily task (comes back every day); «Puntual» = a one-off task. Both already belong to this project.
    if (kind === 'diaria') insert('daily_tasks', [{ title: text.trim(), position: daily_tasks.reduce((m, d) => Math.max(m, d.position + 1), 0), ...NEW_DAILY, project_id: project.id }])
    else createTask({ title: text.trim(), project_id: project.id })
    setText('')
  }
  const cover = projectCover(project, { tasks, notes, daily_tasks }, 4)

  return (
    <Page back="Proyectos" onBack={onBack} actions={<button className="link" onClick={() => setEditing(true)}>Editar</button>}>
      <header className="today-head">
        {/* The cover: the same collection card aesthetic as in the list, bigger. */}
        <div style={tintStyle(project.color)} className={`pcard project-cover ${cardTone(project)}`}>
          <Collage cover={cover} icon={project.icon} big />
          <h1 className="pcard-name">{project.name}</h1>
          <p className="pcard-meta">{shortDate(cover.day)} · {coverSummary(cover)}</p>
          <div className="project-cover-foot">
            <span className="tile-label">{PROJECT_STATUS[project.status]}</span>
            <TagChips tags={project.tags} />
          </div>
        </div>
        {!project.icon && <button className="add-line" onClick={() => setEditing(true)}><span aria-hidden>＋</span>Añadir foto o icono de portada</button>}
        {writingDesc
          ? <DescriptionBox initial={project.description ?? ''} onSave={(description) => update('projects', project.id, { description }).then(() => setWritingDesc(false))} onCancel={() => setWritingDesc(false)} />
          : project.description
            ? <button className="project-desc-btn" onClick={() => setWritingDesc(true)} aria-label="Editar descripción"><p className="butler project-desc">{project.description}</p></button>
            : <button className="add-line" onClick={() => setWritingDesc(true)}><span aria-hidden>＋</span>Añadir una descripción</button>}
      </header>

      {daily.length > 0 && (
        <section className="group">
          <h2 className="group-title">Tareas diarias · {daily.length}</h2>
          <DailyGrid list={daily} deletable />
        </section>
      )}

      {reminders.length > 0 && (
        <section className="group">
          <h2 className="group-title">Recordatorios · {reminders.length}</h2>
          <ul className="list card-list">{reminders.map((t) => <TaskRow key={t.id} task={t} deletable />)}</ul>
        </section>
      )}

      <section className="group">
        <h2 className="group-title">Tareas{todo.length > 0 && ` · ${todo.length}`}</h2>
        {todo.length > 0 && <ul className="list card-list">{todo.map((t) => <TaskRow key={t.id} task={t} deletable />)}</ul>}
        <Choice value={kind} options={{ puntual: 'Puntual', diaria: 'Diaria' }} onChange={setKind} />
        <form className="add-line input" onSubmit={(e) => (e.preventDefault(), addTask())}>
          <span aria-hidden>＋</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Añadir tarea ${kind}`} aria-label={`Añadir tarea ${kind}`} enterKeyHint="done" maxLength={500} />
          {text.trim() && <button className="add-go">Añadir</button>}
        </form>
      </section>

      <section className="group">
        <h2 className="group-title">Notas{ownNotes.length > 0 && ` · ${ownNotes.length}`}</h2>
        {ownNotes.length ? (
          <ul className="list card-list">
            {ownNotes.map((n) => (
              <li key={n.id}>
                <button className="note-row" onClick={() => openNote(n.id)}>
                  <span className={`dot c-${noteTone(n)}`} aria-hidden />
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
        <button className="add-line" onClick={() => createNote({ project_id: project.id }).then((n) => openNote(n.id))}><span aria-hidden>＋</span>Nueva nota</button>
      </section>

      {editing && <ProjectSheet project={project} onClose={() => setEditing(false)} onDeleted={onBack} />}
    </Page>
  )
}

/** The description written in place (no settings screen): a box, Guardar / Cancelar. Empty = no description. */
function DescriptionBox({ initial, onSave, onCancel }: { initial: string; onSave: (description: string | null) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial)
  return (
    <div className="desc-box">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="¿De qué va este proyecto?" rows={3} maxLength={2000} autoFocus aria-label="Descripción" />
      <div className="desc-actions">
        <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="primary" onClick={() => onSave(text.trim() || null)}>Guardar</button>
      </div>
    </div>
  )
}

/** «＋» in Proyectos: the name, then the project opens to add the rest. */
function NewProject({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const [p] = await insert('projects', [{ name: name.trim(), status: 'activo', description: null, icon: null, tags: [], next_step: null, area: null, color: 'none' }])
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
export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { projects, tasks } = useData()
  const [text, setText] = useState('')
  const others = allTags(projects, tasks).filter((t) => !tags.includes(t))
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
      <span className="hint">Una etiqueta sirve para varias tareas o proyectos. Luego busca #etiqueta para verlo todo junto.</span>
    </div>
  )
}

function ProjectSheet({ project: initialProject, onClose, onDeleted }: { project: Project; onClose: () => void; onDeleted: () => void }) {
  const { projects } = useData()
  const project = projects.find((p) => p.id === initialProject.id) ?? initialProject
  const set = (patch: Partial<Project>) => update('projects', project.id, patch)
  const heroColor = colorKey(project.color)
  return (
    <Sheet title="Proyecto" onClose={onClose}>
      {/* Preview: the same colour as its tile and cover (its own, or the automatic pastel). */}
      <div style={tintStyle(project.color)} className={`project-hero ${heroColor ? `colored dc-${heroColor}` : pastelOf(project.id)} ${project.icon ? 'has-art' : ''}`}>
        {project.icon ? <DailyArt icon={project.icon} big /> : <ItemIcon icon={null} name={project.name} big />}
        <h2 className="hero-title">{project.name}</h2>
      </div>
      <input className="big-input" defaultValue={project.name} onBlur={(e) => e.target.value.trim() && e.target.value !== project.name && set({ name: e.target.value.trim() })} aria-label="Nombre" />
      <div className="field">Color
        <ColorPicker value={project.color} onChange={(color) => set({ color })} />
      </div>
      <IconPicker icon={project.icon} onChange={(icon) => set({ icon })} label="Imagen o icono" />
      <TagEditor tags={project.tags ?? []} onChange={(tags) => set({ tags })} />
      <div className="field">Estado
        <Choice value={project.status} options={PROJECT_STATUS} onChange={(status) => set({ status })} />
      </div>
      <label className="field">Descripción
        <textarea rows={3} placeholder="De qué va, en una o dos frases" defaultValue={project.description ?? ''} onBlur={(e) => e.target.value !== (project.description ?? '') && set({ description: e.target.value.trim() || null })} />
      </label>
      <button className="ghost danger" onClick={() => confirm('¿Borrar este proyecto? Sus tareas y notas se quedan, sin proyecto.') && remove('projects', project.id).then(onClose).then(onDeleted)}>Borrar proyecto</button>
    </Sheet>
  )
}
