import { useState } from 'react'
import { byPriority } from '../logic'
import { KEEP_CLOSED_DAYS, useData } from '../store'
import { ClosedRow, TaskRow } from '../TaskRow'
import type { Status } from '../types'

const GROUPS: [Status, string][] = [['en_curso', 'En curso'], ['abierto', 'Abiertas'], ['esperando', 'Esperando']]

export default function Tasks() {
  const { tasks, closed } = useData()
  const [showClosed, setShowClosed] = useState(false)
  const sorted = [...tasks].sort(byPriority)

  return (
    <>
      <h1 className="page-title">Tareas</h1>
      {!tasks.length && <p className="empty">No hay tareas abiertas. Pulsa ＋ para apuntar algo.</p>}
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
