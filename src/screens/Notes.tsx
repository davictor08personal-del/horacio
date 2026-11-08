import { useState } from 'react'
import { allTags, byEdited, dailyOfNote, noteTone, imagePaths, noteMatches, notePreview, noteTime, parseSearch, projectsTagged, stripImages } from '../logic'
import { useImageUrl } from '../noteImages'
import { ICON, Icon, openNote } from '../NoteEditor'
import { createNote, useData } from '../store'
import type { Note } from '../types'

// The mosaic/list choice is a per-device preference, so it lives in localStorage (it can fail in private mode).
// The mosaic is the default; only an explicit «list» keeps the list.
const VIEW_KEY = 'cuadre-notes-view'
const savedView = () => { try { return (localStorage.getItem(VIEW_KEY) ?? localStorage.getItem('horacio-notes-view')) !== 'list' } catch { return true } }


/**
 * «Notas»: a mosaic of colour blocks (like the project tiles), pinned ones full width on top; chips filter by
 * pinned or by the tags of their projects. The list view (iOS Notes look) is one tap away. Archive as in Keep.
 */
export default function Notes() {
  const { notes, tasks, daily_tasks, projects } = useData()
  const [query, setQuery] = useState('')
  const [grid, setGrid] = useState(savedView)
  const [archive, setArchive] = useState(false)
  const [filter, setFilter] = useState<string>('all') // 'all', 'pinned' or a tag

  const toggleView = () => {
    setGrid(!grid)
    try { localStorage.setItem(VIEW_KEY, grid ? 'list' : 'grid') } catch { /* only a preference */ }
  }
  const linked = new Set(tasks.map((t) => t.note_id))
  const live = notes.filter((n) => n.archived === archive)
  // Tags worth a chip: those of the projects that have notes here.
  const chipTags = allTags(projects.filter((p) => live.some((n) => n.project_id === p.id)))
  // «#idiomas» = the notes of every project tagged #idiomas; the rest of the words search the text.
  const { tags, text } = parseSearch(query)
  const allTagFilters = [...tags, ...(filter !== 'all' && filter !== 'pinned' ? [filter] : [])]
  const tagged = allTagFilters.length ? projectsTagged(projects, allTagFilters) : null
  const shown = live
    .filter((n) => (filter !== 'pinned' || n.pinned) && (!tagged || (!!n.project_id && tagged.has(n.project_id))) && noteMatches(n, text))
    .sort(byEdited)
  const pinned = shown.filter((n) => n.pinned)
  const rest = shown.filter((n) => !n.pinned)
  const compose = () => createNote().then((n) => openNote(n.id))
  const card = (n: Note, wide = false) => (
    <NoteCard key={n.id} note={n} wide={wide} reminder={linked.has(n.id)} daily={dailyOfNote(daily_tasks, n.id)?.title} project={projects.find((p) => p.id === n.project_id)?.name} />
  )

  const section = (title: string, list: Note[]) => list.length > 0 && (
    <section className="group" key={title}>
      {title && <h2 className="group-title">{title}</h2>}
      <ul className="list card-list">{list.map((n) => <NoteRow key={n.id} note={n} reminder={linked.has(n.id)} daily={dailyOfNote(daily_tasks, n.id)?.title} project={projects.find((p) => p.id === n.project_id)?.name} />)}</ul>
    </section>
  )
  const chip = (key: string, label: string, count?: number) => (
    <button type="button" key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(filter === key && key !== 'all' ? 'all' : key)}>
      {label}{count != null && <span className="chip-count">{count}</span>}
    </button>
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

      {live.length > 0 && (
        <div className="choice filter-chips">
          {chip('all', 'Todas', live.length)}
          {live.some((n) => n.pinned) && chip('pinned', 'Fijadas', live.filter((n) => n.pinned).length)}
          {chipTags.map((t) => chip(t, `#${t}`))}
        </div>
      )}

      {grid ? (
        shown.length > 0 && <div className="note-bento">{pinned.map((n) => card(n, true))}{rest.map((n) => card(n))}</div>
      ) : (
        <>
          {section('Fijadas', pinned)}
          {section(pinned.length ? 'Otras' : '', rest)}
        </>
      )}

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
        <span className={`dot c-${noteTone(note)}`} aria-hidden />
        <span className="note-row-text">
          <span className="task-title">{note.title.trim() || notePreview(note) || (imagePaths(note.body).length ? 'Imagen' : 'Nota nueva')}</span>
          <span className="task-sub">
            {daily && <span className="daily-note-tag">Diaria · {daily}</span>}
            <span className="note-time">{noteTime(note.updated_at)}</span>{project && <span className="note-row-project"> · {project}</span>}
          </span>
        </span>
        <Thumb body={note.body} className="note-thumb" />
        {reminder && <span className="note-flag" aria-label="Con recordatorio"><Icon d={ICON.bell} /></span>}
      </button>
    </li>
  )
}

/**
 * A colour block in the mosaic: its project on top, the title big, then the text (or the first items of the
 * list) cut after a few lines. `wide` (pinned) takes the whole row.
 */
function NoteCard({ note, reminder, daily, project, wide }: { note: Note; reminder: boolean; daily?: string; project?: string; wide?: boolean }) {
  return (
    <button className={`note-card c-${noteTone(note)} ${wide ? 'wide' : ''}`} onClick={() => openNote(note.id)}>
      {(project || note.pinned) && <span className="tile-label">{[note.pinned && 'Fijada', project].filter(Boolean).join(' · ')}</span>}
      {!note.items && <Thumb body={note.body} className="note-card-img" />}
      {note.title.trim() && <strong>{note.title}</strong>}
      {note.items ? (
        <ul className="card-checks">
          {note.items.slice(0, 6).map((i, k) => <li key={k} className={i.done ? 'done' : ''}>{i.text}</li>)}
          {note.items.length > 6 && <li className="muted">+{note.items.length - 6}</li>}
        </ul>
      ) : (
        stripImages(note.body) && <span className="card-body">{stripImages(note.body)}</span>
      )}
      {daily && <span className="daily-note-tag">Diaria · {daily}</span>}
      <span className="card-foot">{noteTime(note.updated_at)}{reminder && <Icon d={ICON.bell} />}</span>
    </button>
  )
}

/** The first picture of a note, small, for the lists. */
function Thumb({ body, className }: { body: string; className: string }) {
  const first = imagePaths(body)[0]
  const url = useImageUrl(first)
  return first && url ? <img className={className} src={url} alt="" loading="lazy" /> : null
}
