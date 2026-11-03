import { useState } from 'react'
import { byPriority } from '../logic'
import { useData } from '../store'
import { TaskRow } from '../TaskRow'
import type { Status } from '../types'
import Projects from './Projects'

const GROUPS: [Status, string][] = [['en_curso', 'En curso'], ['abierto', 'Abiertas'], ['esperando', 'Esperando']]

export default function Tasks() {
  const { tasks, projects } = useData()
  const [showProjects, setShowProjects] = useState(false)
  const sorted = [...tasks].sort(byPriority)
  const active = projects.filter((p) => p.status === 'activo').length

  return (
    <>
      <h1 className="page-title">Tareas</h1>
      <button className="wait-line" onClick={() => setShowProjects(true)}>
        <span><strong>Proyectos</strong> · {active ? `${active} ${active === 1 ? 'activo' : 'activos'}` : 'apunta los tuyos'}</span>
        <span className="chev" aria-hidden>›</span>
      </button>
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
      {showProjects && <Projects onBack={() => setShowProjects(false)} />}
    </>
  )
}
