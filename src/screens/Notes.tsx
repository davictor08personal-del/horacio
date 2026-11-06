import { useState } from 'react'
import { byEdited, dailyOfNote, noteMatches, notePreview, noteTime, parseSearch, projectsTagged } from '../logic'
import { ICON, Icon, openNote } from '../NoteEditor'
import { createNote, useData } from '../store'
import type { Note } from '../types'

// The list/grid choice is a per-device preference, so it lives in localStorage (it can fail in private mode).
const VIEW_KEY = 'cuadre-notes-view'
const savedView = () => { try { return (localStorage.getItem(VIEW_KEY) ?? localStorage.getItem('horacio-notes-view')) === 'grid' } catch { return false } }

/** «Notas»: iOS Notes look (big title, search, grouped list) with Keep's pin, colours, grid and archive. */
export default function Notes() {
  const { notes, tasks, daily_tasks, projects } = useData()
  const [query, setQuery] = useState('')
  const [grid, setGrid] = useState(savedView)
  const [archive, setArchive] = useState(false)

  const toggleView = () => {
    setGrid(!grid)
    try { localStorage.setItem(VIEW_KEY, grid ? 'list' : 'grid') } catch { /* only a preference */ }
  }
  const linked = new Set(tasks.map((t) => t.note_id))
  // «#idiomas» = the notes of every project tagged #idiomas; the rest of the words search the text.
  const { tags, text } = parseSearch(query)
  const tagged = tags.length ? projectsTagged(projects, tags) : null
  const shown = notes.filter((n) => n.archived === archive && (!tagged || (!!n.project_id && tagged.has(n.project_id))) && noteMatches(n, text)).sort(byEdited)
  const pinned = shown.filter((n) => n.pinned)
  const rest = shown.filter((n) => !n.pinned)
  const compose = () => createNote().then((n) => openNote(n.id))

  const section = (title: string, list: Note[]) => list.length > 0 && (
    <section className="group" key={title}>
      {title && <h2 className="group-title">{title}</h2>}
      {grid ? (
        <div className="note-grid">{list.map((n) => <NoteCard key={n.id} note={n} reminder={linked.has(n.id)} daily={dailyOfNote(daily_tasks, n.id)?.title} project={projects.find((p) => p.id === n.project_id)?.name} />)}</div>
      ) : (
        <ul className="list card-list">{list.map((n) => <NoteRow key={n.id} note={n} reminder={linked.has(n.id)} daily={dailyOfNote(daily_tasks, n.id)?.title} project={projects.find((p) => p.id === n.project_id)?.name} />)}</ul>
      )}
    </section>
  )

  return (
    <>
      <header className="notes-head">
        <div className="title-left">
          <h1 className="page-title">{archive ? 'Archivo' : 'Notas'}</h1>
          {!archive && <button className="add-btn" onClick={compose} aria-label="Nueva nota"><svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" /></svg></button>}
        </div>
        <div className="note-bar-actions">
          <button className={`icon-btn ${archive ? 'on' : ''}`} onClick={() => setArchive(!archive)} aria-label={archive ? 'Ver notas' : 'Ver archivo'} aria-pressed={archive}><Icon d={ICON.archive} /></button>
          <button className="icon-btn" onClick={toggleView} aria-label={grid ? 'Ver en lista' : 'Ver en cuadrícula'}><Icon d={grid ? ICON.list : ICON.grid} /></button>
        </div>
      </header>

      <label className="search">
        <Icon d={ICON.search} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar o #etiqueta" aria-label="Buscar notas" />
        {query && <button className="ghost" onClick={() => setQuery('')} aria-label="Borrar búsqueda"><Icon d={ICON.x} /></button>}
      </label>

      {section('Fijadas', pinned)}
      {section(pinned.length ? 'Otras' : '', rest)}

      {!shown.length && (
        <p className="empty">
          {query ? `Nada coincide con «${query}».` : archive ? 'No hay notas archivadas.' : 'Sin notas. Pulsa ＋ junto al título para escribir la primera.'}
        </p>
      )}
      {shown.length > 0 && <p className="note-count">{shown.length} {shown.length === 1 ? 'nota' : 'notas'}</p>}
    </>
  )
}

/** A row: bold title, then when and which project (not the first line of the text). */
function NoteRow({ note, reminder, daily, project }: { note: Note; reminder: boolean; daily?: string; project?: string }) {
  return (
    <li>
      <button className="note-row" onClick={() => openNote(note.id)}>
        {note.color !== 'none' && <span className={`dot c-${note.color}`} aria-hidden />}
        <span className="note-row-text">
          <span className="task-title">{note.title.trim() || notePreview(note) || 'Nota nueva'}</span>
          <span className="task-sub">
            {daily && <span className="daily-note-tag">Diaria · {daily}</span>}
            <span className="note-time">{noteTime(note.updated_at)}</span>{project && <span className="note-row-project"> · {project}</span>}
          </span>
        </span>
        {reminder && <span className="note-flag" aria-label="Con recordatorio"><Icon d={ICON.bell} /></span>}
      </button>
    </li>
  )
}

/** Keep card: coloured, the text (or the first items of the list) cut after a few lines. */
function NoteCard({ note, reminder, daily, project }: { note: Note; reminder: boolean; daily?: string; project?: string }) {
  return (
    <button className={`note-card c-${note.color}`} onClick={() => openNote(note.id)}>
      {note.title.trim() && <strong>{note.title}</strong>}
      {note.items ? (
        <ul className="card-checks">
          {note.items.slice(0, 6).map((i, k) => <li key={k} className={i.done ? 'done' : ''}>{i.text}</li>)}
          {note.items.length > 6 && <li className="muted">+{note.items.length - 6}</li>}
        </ul>
      ) : (
        note.body.trim() && <span className="card-body">{note.body}</span>
      )}
      {daily && <span className="daily-note-tag">Diaria · {daily}</span>}
      <span className="card-foot">{noteTime(note.updated_at)}{project && ` · ${project}`}{reminder && <Icon d={ICON.bell} />}</span>
    </button>
  )
}
