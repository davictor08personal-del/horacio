import { useState } from 'react'
import type { Tab } from '../App'
import DailyTasks from '../DailyTasks'
import { openDailyView } from './Tasks'
import Page from '../Page'
import Agenda from './Agenda'
import { addDays, dayPlan, doneToday, fullDate, greeting, localDay, nextFpBlock, shortDate, splitToday } from '../logic'
import { useData } from '../store'
import { TaskRow } from '../TaskRow'

const WEEK_LETTERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/**
 * «Hoy»: the greeting, a hero card with how much is on today's plate, this week as a strip of day pills,
 * then the priorities (Foco), daily tasks, and two tiles for studies and what can wait.
 */
export default function Today({ onGo }: { onGo: (t: Tab) => void }) {
  const { tasks, closed, shifts, fp_tests, profile, daily_tasks } = useData()
  const withShifts = !!profile?.shifts
  const withFp = !!profile?.fp
  const [agenda, setAgenda] = useState(false) // shifts and studies (optional modules) live here, out of the tab bar
  const today = localDay()
  const plan = dayPlan(shifts.find((s) => s.day === today))
  const { focus, later, waiting } = splitToday(tasks)
  const fp = withFp ? nextFpBlock(fp_tests, today) : null
  const hasShifts = shifts.some((s) => s.day >= today)
  const dailyDone = daily_tasks.filter((d) => doneToday(d, today)).length
  const allDoneToday = !focus.length && closed.some((t) => t.status === 'hecho' && t.done_at && localDay(new Date(t.done_at)) === today)
  const canWait = later.length + waiting.length

  return (
    <>
      <header className="today-head">
        <span className="eyebrow">{fullDate(today)}</span>
        <h1>{greeting()}{profile?.name ? `, ${profile.name}` : ''}.</h1>
      </header>

      <section className="hero-card">
        <div className="hero-top">
          <div className="hero-copy">
            <h2 className="hero-heading">{focus.length ? 'Prioridades de hoy' : allDoneToday ? 'Todo hecho' : 'Nada urgente'}</h2>
            <p className="hero-sub">
              {withShifts ? plan.line : focus.length ? 'Empieza por la primera de la lista.' : allDoneToday ? 'Prioridades terminadas. Buen trabajo.' : 'Apunta algo con ＋ y aquí verás por dónde empezar.'}
            </p>
          </div>
          <div className="hero-stat" aria-label={`${focus.length} por hacer`}>
            <span className="hero-num">{focus.length}</span>
            <span className="hero-unit">por hacer</span>
          </div>
        </div>
        <div className="hero-chips">
          {daily_tasks.length > 0 && <span className="hero-chip">Diarias {dailyDone}/{daily_tasks.length}</span>}
          {waiting.length > 0 && <span className="hero-chip">{waiting.length} esperando</span>}
          {(withShifts || withFp) && (
            <button className="hero-chip action" onClick={() => setAgenda(true)}>
              {withShifts && !hasShifts ? 'Añadir turnos' : withShifts && withFp ? 'Turnos y estudios' : withShifts ? 'Turnos' : 'Estudios'} ›
            </button>
          )}
        </div>
      </section>

      <WeekStrip today={today} due={new Set(tasks.map((t) => t.due_date).filter((d): d is string => !!d))} />

      {focus.length > 0 && (
        <section className="group">
          <h2 className="group-title">Por orden</h2>
          <ul className="list card-list focus-list">{focus.map((t, i) => <TaskRow key={t.id} task={t} n={i + 1} />)}</ul>
        </section>
      )}

      <DailyTasks onSeeAll={() => { openDailyView(); onGo('tasks') }} />

      {(fp || canWait > 0) && (
        <div className="bento">
          {fp && (
            <div className="tile tile-blue">
              <span className="tile-label">Estudios</span>
              <span className="tile-num">{fp.days}</span>
              <span className="tile-text">
                {fp.days === 1 ? 'día' : 'días'} para el bloque ({shortDate(fp.opensOn)}{fp.subjects.length === 1 ? ` · ${fp.subjects[0]}` : ''}).{' '}
                {fp.unread ? `Quedan ${fp.unread} de ${fp.units} por leer.` : 'Ya lo has leído todo.'}
              </span>
            </div>
          )}
          {canWait > 0 && (
            <button className="tile tile-peach" onClick={() => onGo('tasks')}>
              <span className="tile-label">Puede esperar</span>
              <span className="tile-num">{canWait}</span>
              <span className="tile-text">
                {[later.length && `${later.length} ${later.length === 1 ? 'tarea' : 'tareas'} más`, waiting.length && `${waiting.length} esperando`].filter(Boolean).join(' · ')} ›
              </span>
            </button>
          )}
        </div>
      )}
      {agenda && <Page back="Hoy" onBack={() => setAgenda(false)}><Agenda /></Page>}
    </>
  )
}

/** Today and the next six days as tall pills; today is the dark one, and a dot marks a day with something due. */
function WeekStrip({ today, due }: { today: string; due: Set<string> }) {
  return (
    <div className="week-strip" role="list" aria-label="Próximos 7 días">
      {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => {
        const name = WEEK_LETTERS[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7] // getUTCDay: 0 = Sunday
        return (
          <div key={d} role="listitem" className={`week-pill ${d === today ? 'today' : ''}`} aria-label={`${name} ${Number(d.slice(8))}${due.has(d) ? ', con tareas' : ''}`}>
            <span className={`week-mark ${due.has(d) ? 'on' : ''}`} aria-hidden />
            <span className="week-name">{name}</span>
            <span className="week-num">{Number(d.slice(8))}</span>
          </div>
        )
      })}
    </div>
  )
}
