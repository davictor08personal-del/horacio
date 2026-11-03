import type { Tab } from '../App'
import DailyTasks from '../DailyTasks'
import { dayPlan, greeting, longDate, madridDay, nextFpBlock, shortDate, splitToday } from '../logic'
import { useData } from '../store'
import { TaskRow } from '../TaskRow'

// Single user for now. When Horacio is for anyone, the name comes from their profile.
const OWNER = 'Victor'

/** «Hoy»: Horacio's hello and the day (shift or free), Foco, Tareas diarias, FP and the one line of what can wait. */
export default function Today({ onGo }: { onGo: (t: Tab) => void }) {
  const { tasks, shifts, fp_tests } = useData()
  const today = madridDay()
  const plan = dayPlan(shifts.find((s) => s.day === today))
  const { focus, later, waiting } = splitToday(tasks)
  const fp = nextFpBlock(fp_tests, today)
  const hasShifts = shifts.some((s) => s.day >= today)

  return (
    <>
      <header className="today-head">
        <h1>{greeting()}, {OWNER}</h1>
        <p className="day-line"><span className="day-date">{longDate(today)}</span> · {plan.work ? `${plan.title} · ${plan.free}` : plan.free}</p>
        {!hasShifts && <button className="link" onClick={() => onGo('agenda')}>Aún no hay turnos de esta semana · Añadir</button>}
      </header>

      <section className="group">
        <h2 className="group-title">Foco</h2>
        {focus.length ? (
          <ul className="list card-list">{focus.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
        ) : (
          <p className="empty">Nada urgente. Pulsa ＋ para apuntar algo.</p>
        )}
      </section>

      <DailyTasks />

      {fp && (
        <section className="group">
          <h2 className="group-title">FP</h2>
          <div className="fp-card">
            <strong>{fp.days === 1 ? 'Mañana' : `En ${fp.days} días`}</strong>
            <span>abre el siguiente bloque de tests ({shortDate(fp.opensOn)}{fp.subjects.length === 1 ? ` · ${fp.subjects[0]}` : ''})</span>
            <span className="muted">{fp.unread ? `${fp.unread} de ${fp.units} ${fp.units === 1 ? 'unidad' : 'unidades'} sin leer` : 'Todas las unidades leídas'}</span>
          </div>
        </section>
      )}

      {(later.length > 0 || waiting.length > 0) && (
        <button className="wait-line" onClick={() => onGo('tasks')}>
          <span><strong>Puede esperar:</strong> {[later.length && `${later.length} ${later.length === 1 ? 'tarea' : 'tareas'} más`, waiting.length && `${waiting.length} esperando`].filter(Boolean).join(' · ')}</span>
          <span className="chev" aria-hidden>›</span>
        </button>
      )}
    </>
  )
}
