import { useState } from 'react'
import type { Tab } from '../App'
import DailyTasks from '../DailyTasks'
import { openDailyView } from './Tasks'
import Page from '../Page'
import Agenda from './Agenda'
import { dayPlan, fullDate, greeting, localDay, nextFpBlock, shortDate, splitToday } from '../logic'
import { useData } from '../store'
import { TaskRow } from '../TaskRow'


/** «Hoy»: the greeting (and the day, with shifts), then the priorities (Foco), daily tasks, studies and what can wait. */
export default function Today({ onGo }: { onGo: (t: Tab) => void }) {
  const { tasks, closed, shifts, fp_tests, profile } = useData()
  const withShifts = !!profile?.shifts
  const withFp = !!profile?.fp
  const [agenda, setAgenda] = useState(false) // shifts and studies (optional modules) live here, out of the tab bar
  const today = localDay()
  const plan = dayPlan(shifts.find((s) => s.day === today))
  const { focus, later, waiting } = splitToday(tasks)
  const fp = withFp ? nextFpBlock(fp_tests, today) : null
  const hasShifts = shifts.some((s) => s.day >= today)

  return (
    <>
      <header className="today-head">
        <div className="head-top">
          <span className="eyebrow">{fullDate(today)}</span>
        </div>
        <h1>{greeting()}{profile?.name ? `, ${profile.name}` : ''}.</h1>
        {withShifts && <p className="butler">{plan.line}</p>}
        {(withShifts || withFp) && (
          <button className="link" onClick={() => setAgenda(true)}>
            {withShifts && !hasShifts ? 'Aún no hay turnos de esta semana · Añadir' : withShifts && withFp ? 'Turnos y estudios' : withShifts ? 'Turnos' : 'Estudios'}
          </button>
        )}
      </header>

      <section className="group">
        <h2 className="group-title">{focus.length ? 'Prioridades de hoy' : 'Nada urgente'}</h2>
        {focus.length ? (
          <ul className="list card-list focus-list">{focus.map((t, i) => <TaskRow key={t.id} task={t} n={i + 1} />)}</ul>
        ) : closed.some((t) => t.status === 'hecho' && t.done_at && localDay(new Date(t.done_at)) === today) ? (
          <p className="all-done fade-in"><span aria-hidden>🎉</span> Prioridades terminadas. Buen trabajo.</p>
        ) : (
          <p className="empty fade-in">Cuando apuntes algo con ＋, aquí verás por dónde empezar.</p>
        )}
      </section>

      <DailyTasks onSeeAll={() => { openDailyView(); onGo('tasks') }} />

      {fp && (
        <p className="fp-card">
          <em>Estudios:</em> el siguiente bloque abre {fp.days === 1 ? 'mañana' : `en ${fp.days} días`} ({shortDate(fp.opensOn)}{fp.subjects.length === 1 ? ` · ${fp.subjects[0]}` : ''}){' '}
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
