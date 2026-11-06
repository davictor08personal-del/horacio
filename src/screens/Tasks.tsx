import { byPriority } from '../logic'
import { useData } from '../store'
import { TaskRow } from '../TaskRow'
import type { Status } from '../types'

const GROUPS: [Status, string][] = [['en_curso', 'En curso'], ['abierto', 'Abiertas'], ['esperando', 'Esperando']]

export default function Tasks() {
  const { tasks } = useData()
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
    </>
  )
}
