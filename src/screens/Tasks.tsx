import { useState } from 'react'
import { byPriority, parseSearch, projectsTagged, textMatches } from '../logic'
import { ICON, Icon } from '../NoteEditor'
import { KEEP_CLOSED_DAYS, useData } from '../store'
import { ClosedRow, TaskRow } from '../TaskRow'
import type { Status, Task } from '../types'

const GROUPS: [Status, string][] = [['en_curso', 'En curso'], ['abierto', 'Abiertas'], ['esperando', 'Esperando']]

export default function Tasks() {
  const { tasks: allOpen, closed: allClosed, projects } = useData()
  const [showClosed, setShowClosed] = useState(false)
  const [query, setQuery] = useState('')
  // «#idiomas» = the tasks of every project tagged #idiomas; the rest of the words search title and details.
  const { tags, text } = parseSearch(query)
  const tagged = tags.length ? projectsTagged(projects, tags) : null
  const matches = (t: Task) => (!tagged || (!!t.project_id && tagged.has(t.project_id))) && textMatches(text, t.title, t.notes)
  const tasks = allOpen.filter(matches)
  const closed = allClosed.filter(matches)
  const sorted = [...tasks].sort(byPriority)

  return (
    <>
      <h1 className="page-title">Tareas</h1>
      {(allOpen.length > 0 || allClosed.length > 0) && (
        <label className="search">
          <Icon d={ICON.search} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar o #etiqueta" aria-label="Buscar tareas" />
          {query && <button className="ghost" onClick={() => setQuery('')} aria-label="Borrar búsqueda"><Icon d={ICON.x} /></button>}
        </label>
      )}
      {!tasks.length && <p className="empty">{query ? 'Ninguna tarea abierta coincide.' : 'No hay tareas abiertas. Pulsa ＋ para apuntar algo.'}</p>}
      {GROUPS.map(([status, label]) => {
        const list = sorted.filter((t) => t.status === status)
        return list.length > 0 && (
          <section className="group" key={status}>
            <h2 className="group-title">{label} · {list.length}</h2>
            <ul className="list card-list">{list.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          </section>
        )
      })}
      {closed.length > 0 && (
        <section className="group">
          <button className="group-head group-toggle" onClick={() => setShowClosed(!showClosed)} aria-expanded={showClosed}>
            <h2 className="group-title">Terminadas · {closed.length}</h2>
            <span className="chev" aria-hidden>{showClosed ? '⌄' : '›'}</span>
          </button>
          {showClosed && (
            <>
              <ul className="list card-list">{closed.map((t) => <ClosedRow key={t.id} task={t} />)}</ul>
              <p className="hint">Se borran solas a los {KEEP_CLOSED_DAYS} días. Toca el círculo para reabrir una.</p>
            </>
          )}
        </section>
      )}
    </>
  )
}
