import { useState } from 'react'
import type { Tab } from '../App'
import DailyTasks from '../DailyTasks'
import Page from '../Page'
import Agenda from './Agenda'
import { OWNER, dayPlan, fullDate, greeting, madridDay, nextFpBlock, shortDate, splitToday } from '../logic'
import { useData } from '../store'
import { TaskRow } from '../TaskRow'

// Single user for now. When Cuadre is for anyone, the name comes from their profile.

/** «Hoy»: the greeting and the day, then the priorities (Foco), daily tasks, FP and what can wait. */
export default function Today({ onGo }: { onGo: (t: Tab) => void }) {
  const { tasks, shifts, fp_tests } = useData()
  const [agenda, setAgenda] = useState(false) // out of the tab bar since Proyectos took its place; shifts still shape the day
  const today = madridDay()
  const plan = dayPlan(shifts.find((s) => s.day === today))
  const { focus, later, waiting } = splitToday(tasks)
  const fp = nextFpBlock(fp_tests, today)
  const hasShifts = shifts.some((s) => s.day >= today)

  return (
    <>
      <header className="today-head">
        <div className="head-top">
          <span className="eyebrow">{fullDate(today)}</span>
        </div>
        <h1>{greeting()}, {OWNER}.</h1>
        <p className="butler">{plan.line}</p>
        <button className="link" onClick={() => setAgenda(true)}>{hasShifts ? 'Turnos y FP' : 'Aún no hay turnos de esta semana · Añadir'}</button>
      </header>

      <section className="group">
        <h2 className="group-title">{focus.length ? 'Prioridades de hoy' : 'Nada urgente'}</h2>
        {focus.length ? (
          <ul className="list card-list">{focus.map((t, i) => <TaskRow key={t.id} task={t} n={i + 1} />)}</ul>
        ) : (
          <p className="empty">Cuando apuntes algo con ＋, aquí verás por dónde empezar.</p>
        )}
      </section>

      <DailyTasks />

      {fp && (
        <p className="fp-card">
          <em>Una nota sobre el FP:</em> el siguiente bloque abre {fp.days === 1 ? 'mañana' : `en ${fp.days} días`} ({shortDate(fp.opensOn)}{fp.subjects.length === 1 ? ` · ${fp.subjects[0]}` : ''}){' '}
          {fp.unread ? `y quedan ${fp.unread} de ${fp.units} ${fp.units === 1 ? 'unidad' : 'unidades'} por leer.` : 'y ya lo has leído todo.'}
        </p>
      )}

      {(later.length > 0 || waiting.length > 0) && (
        <button className="wait-line" onClick={() => onGo('tasks')}>
          <span><strong>Puede esperar:</strong> {[later.length && `${later.length} ${later.length === 1 ? 'tarea' : 'tareas'} más`, waiting.length && `${waiting.length} esperando`].filter(Boolean).join(' · ')}</span>
          <span className="chev" aria-hidden>›</span>
        </button>
      )}
      {agenda && <Page back="Hoy" onBack={() => setAgenda(false)}><Agenda /></Page>}
    </>
  )
}
