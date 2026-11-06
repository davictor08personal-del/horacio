import { useState } from 'react'
import { byEdited, dailyOfNote, noteMatches, notePreview, noteTime } from '../logic'
import { ICON, Icon, openNote } from '../NoteEditor'
import { createNote, useData } from '../store'
import type { Note } from '../types'

// The list/grid choice is a per-device preference, so it lives in localStorage (it can fail in private mode).
const VIEW_KEY = 'horacio-notes-view'
const savedView = () => { try { return localStorage.getItem(VIEW_KEY) === 'grid' } catch { return false } }

/** «Notas»: iOS Notes look (big title, search, grouped list) with Keep's pin, colours, grid and archive. */
export default function Notes() {
  const { notes, tasks, daily_tasks } = useData()
  const [query, setQuery] = useState('')
  const [grid, setGrid] = useState(savedView)
  const [archive, setArchive] = useState(false)

  const toggleView = () => {
    setGrid(!grid)
    try { localStorage.setItem(VIEW_KEY, grid ? 'list' : 'grid') } catch { /* only a preference */ }
  }
  const linked = new Set(tasks.map((t) => t.note_id))
  const shown = notes.filter((n) => n.archived === archive && noteMatches(n, query)).sort(byEdited)
  const pinned = shown.filter((n) => n.pinned)
  const rest = shown.filter((n) => !n.pinned)
  const compose = () => createNote().then((n) => openNote(n.id))

  const section = (title: string, list: Note[]) => list.length > 0 && (
    <section className="group" key={title}>
      {title && <h2 className="group-title">{title}</h2>}
      {grid ? (
        <div className="note-grid">{list.map((n) => <NoteCard key={n.id} note={n} reminder={linked.has(n.id)} daily={dailyOfNote(daily_tasks, n.id)?.title} />)}</div>
      ) : (
        <ul className="list card-list">{list.map((n) => <NoteRow key={n.id} note={n} reminder={linked.has(n.id)} daily={dailyOfNote(daily_tasks, n.id)?.title} />)}</ul>
      )}
    </section>
  )

  return (
    <>
      <header className="notes-head">
        <h1 className="page-title">{archive ? 'Archivo' : 'Notas'}</h1>
        <div className="note-bar-actions">
          <button className={`icon-btn ${archive ? 'on' : ''}`} onClick={() => setArchive(!archive)} aria-label={archive ? 'Ver notas' : 'Ver archivo'} aria-pressed={archive}><Icon d={ICON.archive} /></button>
          <button className="icon-btn" onClick={toggleView} aria-label={grid ? 'Ver en lista' : 'Ver en cuadrícula'}><Icon d={grid ? ICON.list : ICON.grid} /></button>
          {!archive && <button className="icon-btn accent" onClick={compose} aria-label="Nueva nota"><Icon d={ICON.compose} /></button>}
        </div>
      </header>

      <label className="search">
        <Icon d={ICON.search} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar notas" />
        {query && <button className="ghost" onClick={() => setQuery('')} aria-label="Borrar búsqueda"><Icon d={ICON.x} /></button>}
      </label>

      {section('Fijadas', pinned)}
      {section(pinned.length ? 'Otras' : '', rest)}

      {!shown.length && (
        <p className="empty">
          {query ? `Nada coincide con «${query}».` : archive ? 'No hay notas archivadas.' : 'Sin notas. Pulsa el lápiz para escribir la primera.'}
        </p>
      )}
      {shown.length > 0 && <p className="note-count">{shown.length} {shown.length === 1 ? 'nota' : 'notas'}</p>}
    </>
  )
}

/** iOS row: bold title, then time and the first line, in grey. */
function NoteRow({ note, reminder, daily }: { note: Note; reminder: boolean; daily?: string }) {
  return (
    <li>
      <button className="note-row" onClick={() => openNote(note.id)}>
        {note.color !== 'none' && <span className={`dot c-${note.color}`} aria-hidden />}
        <span className="note-row-text">
          <span className="task-title">{note.title.trim() || notePreview(note) || 'Nota nueva'}</span>
          <span className="task-sub">
            {daily && <span className="daily-note-tag">Diaria · {daily}</span>}
            <span className="note-time">{noteTime(note.updated_at)}</span> {note.title.trim() ? notePreview(note) || 'Sin texto' : ''}
          </span>
        </span>
        {reminder && <span className="note-flag" aria-label="Con recordatorio"><Icon d={ICON.bell} /></span>}
      </button>
    </li>
  )
}

/** Keep card: coloured, the text (or the first items of the list) cut after a few lines. */
function NoteCard({ note, reminder, daily }: { note: Note; reminder: boolean; daily?: string }) {
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
      <span className="card-foot">{noteTime(note.updated_at)}{reminder && <Icon d={ICON.bell} />}</span>
    </button>
  )
}
