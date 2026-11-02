import { useState } from 'react'
import { dayName, hhmm, madridDay, shiftHours, shortDate, weekOf } from '../logic'
import { insert, remove, update, useData } from '../store'
import Sheet, { Choice } from '../Sheet'
import { SHIFT, type FpTest, type ShiftKind } from '../types'

/** This week's shifts (Monday to Sunday) and the FP tests by subject. */
export default function Agenda() {
  const { shifts, fp_tests } = useData()
  const today = madridDay()
  const [day, setDay] = useState<string | null>(null)
  const [test, setTest] = useState<FpTest | null>(null)
  const subjects = [...new Set(fp_tests.map((t) => t.subject))].sort()

  return (
    <>
      <h1 className="page-title">Agenda</h1>
      <section className="group">
        <h2 className="group-title">Turnos de esta semana</h2>
        <ul className="list card-list">
          {weekOf(today).map((d) => {
            const s = shifts.find((x) => x.day === d)
            return (
              <li key={d}>
                <button className={`shift-row ${d === today ? 'is-today' : ''} ${d < today ? 'past' : ''}`} onClick={() => setDay(d)}>
                  <span className="shift-day">{dayName(d)} <span className="muted">{shortDate(d)}</span></span>
                  <span className={`shift-kind kind-${s?.kind ?? 'none'}`}>
                    {!s ? '—' : s.kind === 'libre' ? 'Libre' : `${SHIFT[s.kind]} ${hhmm(s.starts_at)}–${hhmm(s.ends_at)}`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="hint">Para la semana entera: ＋ y una foto del horario.</p>
      </section>

      <section className="group">
        <h2 className="group-title">Tests del FP</h2>
        {!subjects.length && <p className="empty">Sin tests. Pulsa ＋ y escribe, por ejemplo, «Test de Nóminas U3, bloque 2, abre el 10 de noviembre y cierra el 20».</p>}
        {subjects.map((subject) => (
          <div key={subject} className="subject">
            <h3>{subject}</h3>
            <ul className="list card-list">
              {fp_tests.filter((t) => t.subject === subject).map((t) => (
                <li key={t.id} className="test-row">
                  <button className={`tick small ${t.read ? 'done' : ''}`} onClick={() => update('fp_tests', t.id, { read: !t.read })} aria-label={t.read ? 'Marcar sin leer' : 'Marcar leída'} />
                  <button className="task-text" onClick={() => setTest(t)}>
                    <span className="task-title">{t.unit}</span>
                    <span className="task-sub">
                      {[t.block != null && `Bloque ${t.block}`, t.opens_on && `abre ${shortDate(t.opens_on)}`, t.closes_on && `cierra ${shortDate(t.closes_on)}`].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      {day && <ShiftSheet day={day} onClose={() => setDay(null)} />}
      {test && <TestSheet test={test} onClose={() => setTest(null)} />}
    </>
  )
}

function ShiftSheet({ day, onClose }: { day: string; onClose: () => void }) {
  const current = useData().shifts.find((s) => s.day === day)
  const [kind, setKind] = useState<ShiftKind>(current?.kind ?? 'libre')
  const [hours, setHours] = useState(current ? { starts_at: hhmm(current.starts_at), ends_at: hhmm(current.ends_at) } : shiftHours('libre', day))
  const pick = (k: ShiftKind) => { setKind(k); setHours(shiftHours(k, day)) }
  const save = () => insert('shifts', [{ day, kind, starts_at: hours.starts_at || null, ends_at: hours.ends_at || null }]).then(onClose)

  return (
    <Sheet title={`${dayName(day)} ${shortDate(day)}`} onClose={onClose}>
      <Choice value={kind} options={SHIFT} onChange={pick} />
      {kind !== 'libre' && (
        <div className="two-col">
          <label className="field">Entra<input type="time" value={hours.starts_at ?? ''} onChange={(e) => setHours({ ...hours, starts_at: e.target.value })} /></label>
          <label className="field">Sale<input type="time" value={hours.ends_at === '24:00' ? '23:59' : hours.ends_at ?? ''} onChange={(e) => setHours({ ...hours, ends_at: e.target.value })} /></label>
        </div>
      )}
      <button className="primary" onClick={save}>Guardar</button>
      {current && <button className="ghost danger" onClick={() => remove('shifts', current.id).then(onClose)}>Quitar turno</button>}
    </Sheet>
  )
}

function TestSheet({ test, onClose }: { test: FpTest; onClose: () => void }) {
  const set = (patch: Partial<FpTest>) => update('fp_tests', test.id, patch)
  return (
    <Sheet title={test.subject} onClose={onClose}>
      <input className="big-input" defaultValue={test.unit} onBlur={(e) => e.target.value.trim() && set({ unit: e.target.value.trim() })} aria-label="Unidad" />
      <div className="two-col">
        <label className="field">Abre<input type="date" defaultValue={test.opens_on ?? ''} onChange={(e) => set({ opens_on: e.target.value || null })} /></label>
        <label className="field">Cierra<input type="date" defaultValue={test.closes_on ?? ''} onChange={(e) => set({ closes_on: e.target.value || null })} /></label>
      </div>
      <label className="field">Bloque
        <input type="number" inputMode="numeric" defaultValue={test.block ?? ''} onBlur={(e) => set({ block: e.target.value ? Number(e.target.value) : null })} />
      </label>
      <button className="ghost danger" onClick={() => confirm('¿Borrar este test?') && remove('fp_tests', test.id).then(onClose)}>Borrar test</button>
    </Sheet>
  )
}
