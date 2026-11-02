import { useState } from 'react'
import { byPriority } from '../logic'
import { remove, update, useData } from '../store'
import Sheet, { Choice } from '../Sheet'
import { TaskRow } from '../TaskRow'
import { PROJECT_STATUS, type Project, type Status } from '../types'

const GROUPS: [Status, string][] = [['en_curso', 'En curso'], ['abierto', 'Abiertas'], ['esperando', 'Esperando']]

export default function Tasks() {
  const { tasks, projects } = useData()
  const [editing, setEditing] = useState<Project | null>(null)
  const sorted = [...tasks].sort(byPriority)
  const visible = projects.filter((p) => p.status !== 'hecho')

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

      <section className="group">
        <h2 className="group-title">Proyectos</h2>
        {visible.length ? (
          <ul className="list card-list">
            {visible.map((p) => (
              <li key={p.id}>
                <button className="project" onClick={() => setEditing(p)}>
                  <span className="task-title">{p.name}{p.status === 'pausado' && <span className="muted"> · pausado</span>}</span>
                  <span className="task-sub">{p.next_step ? `Siguiente: ${p.next_step}` : 'Sin siguiente paso'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Sin proyectos. Dile a ＋ «empiezo el proyecto…».</p>
        )}
      </section>
      {editing && <ProjectSheet project={projects.find((p) => p.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function ProjectSheet({ project, onClose }: { project: Project; onClose: () => void }) {
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
      <button className="ghost danger" onClick={() => confirm('¿Borrar este proyecto? Sus tareas se quedan, sin proyecto.') && remove('projects', project.id).then(onClose)}>Borrar proyecto</button>
    </Sheet>
  )
}
