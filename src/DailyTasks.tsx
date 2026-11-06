import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { celebrate } from './celebrate'
import { addDays, byPosition, DEFAULT_DAILY, doneToday, localDay, notePreview, weekOf, weeklyStreak } from './logic'
import { ICON, Icon, openNote } from './NoteEditor'
import { IconPicker } from './ItemIcon'
import { insert, noteFromDaily, remove, toggleDaily, update, useData } from './store'
import Sheet from './Sheet'
import { DAILY_COLORS, type DailyTask } from './types'

const NEW_DAILY = { done_on: null, project_id: null, description: null, icon: null, note_id: null, color: 'none' } as const
const daysOf = (log: { daily_id: string; day: string }[], id: string) => log.filter((l) => l.daily_id === id).map((l) => l.day)

/**
 * «Tareas diarias» on Hoy: only the ones still to do today. Hold one to tick it (confetti, then it leaves);
 * tap it to see its page. All of them, done or not, live in Tareas → Diarias, with their calendar.
 */
export default function DailyTasks({ onSeeAll }: { onSeeAll?: () => void }) {
  const { daily_tasks } = useData()
  const today = localDay()
  const list = [...daily_tasks].sort(byPosition)
  const done = list.filter((d) => doneToday(d, today)).length

  return (
    <section className="group">
      <div className="group-head">
        <h2 className="group-title">Tareas diarias</h2>
        {list.length > 0 && <span className="count">{done} de {list.length}{onSeeAll && <> · <button className="link" onClick={onSeeAll}>Ver todas</button></>}</span>}
      </div>
      {list.length ? (
        <>
          <DailyGrid list={list} hideDone />
          {done === list.length
            ? <p className="all-done fade-in"><span aria-hidden>✨</span> Todas las diarias hechas hoy.</p>
            : <p className="hint">Mantén pulsada una para marcarla · tócala para ver su ficha.</p>}
        </>
      ) : (
        <div className="empty-card">
          <p className="muted">Cosas que haces cada día: se marcan y mañana vuelven.</p>
          <div className="row-actions">
            <button className="secondary" onClick={() => insert('daily_tasks', DEFAULT_DAILY.map((title, position) => ({ title, position, ...NEW_DAILY })))}>Usar ejemplos</button>
            {onSeeAll && <button className="ghost" onClick={onSeeAll}>Crear las mías</button>}
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * The tiles. With `hideDone` (Hoy) a tile ticked today plays its check and confetti, then fades away; the others
 * stay. On a project's page all of them show.
 */
export function DailyGrid({ list, hideDone }: { list: DailyTask[]; hideDone?: boolean }) {
  const { daily_log } = useData()
  const [open, setOpen] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<Set<string>>(new Set()) // just ticked: still on screen while it animates out
  const today = localDay()
  const openDaily = list.find((d) => d.id === open)
  const shown = hideDone ? list.filter((d) => !doneToday(d, today) || leaving.has(d.id)) : list
  const onDone = (id: string) => {
    if (!hideDone) return
    setLeaving((s) => new Set(s).add(id))
    setTimeout(() => setLeaving((s) => { const n = new Set(s); n.delete(id); return n }), 1150)
  }
  return (
    <>
      {shown.length > 0 && (
        <div className="daily-grid">
          {shown.map((d) => (
            <DailyTile key={d.id} d={d} today={today} onOpen={() => setOpen(d.id)} onDone={onDone} leaving={leaving.has(d.id)}
              streak={weeklyStreak(daysOf(daily_log, d.id), today)} />
          ))}
        </div>
      )}
      {openDaily && <DailySheet daily={openDaily} onClose={() => setOpen(null)} />}
    </>
  )
}

/**
 * The picture (or emoji) bleeding in from the left edge and fading out to the right: solid for the first fifth
 * of the tile, gone by about a third. Behind the text, so it's decoration, not a box.
 */
function DailyArt({ icon, big }: { icon: string | null; big?: boolean }) {
  if (!icon) return null
  const cls = `daily-art ${big ? 'big' : ''}`
  return icon.startsWith('data:image/')
    ? <img className={cls} src={icon} alt="" />
    : <span className={`${cls} emoji`} aria-hidden>{icon}</span>
}

const HOLD_MS = 600 // long enough not to fire while scrolling, short enough not to feel slow

/**
 * Tap = open its page. Hold = tick (or untick) for today: the tile sinks a little and a wash sweeps across it from
 * left to right; when it reaches the end it's done, a check pops in and confetti flies. Lifting early or scrolling
 * cancels it. The new state shows at once (optimistic) instead of waiting for the server, so nothing flickers.
 */
function DailyTile({ d, today, streak, onOpen, onDone, leaving }: { d: DailyTask; today: string; streak: number; onOpen: () => void; onDone: (id: string) => void; leaving: boolean }) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  useEffect(() => setOptimistic(null), [d.done_on]) // the saved state arrived
  const on = optimistic ?? doneToday(d, today)
  const [pressing, setPressing] = useState(false)
  const timer = useRef(0)
  const held = useRef(false) // the hold already ticked it: the click that follows must not open the page
  const tile = useRef<HTMLButtonElement>(null)

  const start = (e: PointerEvent) => {
    if (e.button !== 0 || leaving) return
    held.current = false
    setPressing(true)
    timer.current = window.setTimeout(() => {
      held.current = true
      setPressing(false)
      const next = !on
      setOptimistic(next)
      navigator.vibrate?.(next ? [10, 40, 18] : 10)
      if (next) { celebrate(tile.current); onDone(d.id) }
      toggleDaily(d, today).catch(() => setOptimistic(null))
    }, HOLD_MS)
  }
  const cancel = () => { clearTimeout(timer.current); setPressing(false) }
  const color = d.color && d.color !== 'none' ? d.color : null

  return (
    <button
      ref={tile}
      className={`daily-btn ${color ? `colored dc-${color}` : ''} ${d.icon ? 'has-art' : ''} ${on ? 'done' : ''} ${pressing ? 'pressing' : ''} ${leaving ? 'leaving' : ''}`}
      onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onClick={() => (held.current ? (held.current = false) : onOpen())}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${d.title}${on ? ', hecha hoy' : ''}. Abrir ficha; mantén pulsado para marcarla`}
    >
      <DailyArt icon={d.icon} />
      <span className="daily-fill" aria-hidden />
      <span className="daily-text">
        <span className="daily-title">{d.title}</span>
        {streak > 0 && <span className="streak" title={`${streak} ${streak === 1 ? 'semana' : 'semanas'} seguidas`}>🔥 {streak}</span>}
      </span>
      <span className="daily-check" aria-hidden><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
    </button>
  )
}

/**
 * Tareas → Diarias: every daily task, done today or not, each with its streak and a month calendar of the days
 * it was done. Tap one to see its page; it has «Marcar como hecha hoy».
 */
export function DailyList() {
  const { daily_tasks, daily_log } = useData()
  const [open, setOpen] = useState<string | null>(null)
  const [ordering, setOrdering] = useState(false)
  const today = localDay()
  const list = [...daily_tasks].sort(byPosition)
  const openDaily = list.find((d) => d.id === open)

  if (!list.length) {
    return (
      <div className="empty-card">
        <p className="muted">Cosas que haces cada día (el gimnasio, leer, un idioma…): se marcan en Hoy y aquí ves tu calendario. Créalas con ＋.</p>
        <div className="row-actions">
          <button className="secondary" onClick={() => insert('daily_tasks', DEFAULT_DAILY.map((title, position) => ({ title, position, ...NEW_DAILY })))}>Usar ejemplos</button>
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="daily-cards">
        {list.map((d) => {
          const days = daysOf(daily_log, d.id)
          const streak = weeklyStreak(days, today)
          const on = doneToday(d, today)
          const color = d.color && d.color !== 'none' ? d.color : null
          return (
            <article key={d.id} className={`daily-card ${color ? `dc-${color}` : ''}`}>
              <button className={`daily-card-head ${color ? 'colored' : ''} ${d.icon ? 'has-art' : ''}`} onClick={() => setOpen(d.id)}>
                <DailyArt icon={d.icon} />
                <span className="daily-text">
                  <span className="daily-title">{d.title}</span>
                  <span className="daily-sub">{streak ? `🔥 ${streak} ${streak === 1 ? 'semana' : 'semanas'} seguidas` : 'Sin racha aún'}</span>
                </span>
                <span className={`today-pill ${on ? 'on' : ''}`}>{on ? 'Hecha hoy' : 'Pendiente'}</span>
              </button>
              <MonthCalendar days={days} />
            </article>
          )
        })}
      </div>
      <button className="link" onClick={() => setOrdering(true)}>Ordenar o quitar</button>
      {openDaily && <DailySheet daily={openDaily} onClose={() => setOpen(null)} />}
      {ordering && <EditDaily list={list} onClose={() => setOrdering(false)} />}
    </>
  )
}

const WEEK_LETTERS = 'LMXJVSD'
const monthStart = (day: string, offset: number) => {
  const d = new Date(`${day.slice(0, 7)}-01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + offset)
  return d.toISOString().slice(0, 10)
}

/** A month of the days a daily task was done (filled), with ‹ › to look back a year. Colour = the task's (--tile). */
export function MonthCalendar({ days }: { days: string[] }) {
  const [offset, setOffset] = useState(0)
  const today = localDay()
  const first = monthStart(today, offset)
  const done = new Set(days)
  const month = first.slice(0, 7)
  const lead = weekOf(first).indexOf(first) // empty cells before the 1st (weeks start on Monday)
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = first; d.slice(0, 7) === month; d = addDays(d, 1)) cells.push(d)
  const count = cells.filter((d) => d && done.has(d)).length
  const title = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${first}T12:00:00Z`))
  return (
    <div className="month-cal">
      <div className="month-head">
        <button className="ghost" onClick={() => setOffset(offset - 1)} disabled={offset <= -11} aria-label="Mes anterior">‹</button>
        <span className="month-title">{title} · <span className="muted">{count} {count === 1 ? 'día' : 'días'}</span></span>
        <button className="ghost" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Mes siguiente">›</button>
      </div>
      <div className="month-grid">
        {[...WEEK_LETTERS].map((l, i) => <span key={i} className="month-dow">{l}</span>)}
        {cells.map((d, i) => d
          ? <span key={d} className={`month-day ${done.has(d) ? 'on' : ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}`}>{Number(d.slice(8))}</span>
          : <span key={`e${i}`} />)}
      </div>
    </div>
  )
}

/**
 * A daily task's page. First to look at (streak, calendar, description, project, colour, note) without
 * changing anything by accident; the pencil at the top switches to editing everything.
 */
export function DailySheet({ daily, onClose, startEditing = false }: { daily: DailyTask; onClose: () => void; startEditing?: boolean }) {
  const { projects, notes, daily_log } = useData()
  const [editing, setEditing] = useState(startEditing)
  const today = localDay()
  const set = (patch: Partial<DailyTask>) => update('daily_tasks', daily.id, patch)
  const days = daysOf(daily_log, daily.id)
  const streak = weeklyStreak(days, today)
  const note = notes.find((n) => n.id === daily.note_id)
  const project = projects.find((p) => p.id === daily.project_id)
  const on = doneToday(daily, today)
  const color = daily.color && daily.color !== 'none' ? daily.color : null
  // The note follows its daily task into the new project, so both show up there.
  const setProject = (project_id: string | null) => {
    set({ project_id })
    if (note) update('notes', note.id, { project_id })
  }
  const goToNote = (id: string) => { onClose(); openNote(id) }
  const pencil = (
    <button className={`edit-toggle ${editing ? 'on' : ''}`} onClick={() => setEditing(!editing)} aria-label={editing ? 'Terminar de editar' : 'Editar'} aria-pressed={editing}>
      {editing ? 'Listo' : <Icon d={ICON.compose} />}
    </button>
  )

  return (
    <Sheet title="Tarea diaria" onClose={onClose} actions={pencil}>
      <div className={`daily-hero ${color ? `colored dc-${color}` : ''} ${daily.icon ? 'has-art' : ''}`}>
        <DailyArt icon={daily.icon} big />
        {editing
          ? <input className="big-input hero-input" defaultValue={daily.title} onBlur={(e) => e.target.value.trim() && e.target.value !== daily.title && set({ title: e.target.value.trim() })} aria-label="Nombre" />
          : <h3 className="hero-title">{daily.title}</h3>}
      </div>

      {!editing && (
        <>
          <div className={`streak-card ${color ? `dc-${color}` : ''}`}>
            <div className="streak-text">
              <strong>🔥 {streak} {streak === 1 ? 'semana' : 'semanas'}</strong>
              <span className="muted small-text">{streak ? 'seguidas haciéndola al menos un día' : 'Hazla un día esta semana para empezar la racha'}</span>
            </div>
            <MonthCalendar days={days} />
          </div>
          <button className={on ? 'secondary' : 'primary'} onClick={() => toggleDaily(daily, today)}>{on ? 'Hecha hoy · Desmarcar' : 'Marcar como hecha hoy'}</button>

          <dl className="info-list">
            <div><dt>Descripción</dt><dd className={daily.description ? '' : 'muted'}>{daily.description || 'Sin descripción'}</dd></div>
            <div><dt>Proyecto</dt><dd className={project ? '' : 'muted'}>{project?.name ?? 'Ninguno'}</dd></div>
            <div><dt>Color</dt><dd><span className={`swatch-dot dc-${daily.color || 'none'}`} aria-hidden /> {DAILY_COLORS[daily.color || 'none'] ?? 'Sin color'}</dd></div>
          </dl>
          {note && (
            <button className="note-link" onClick={() => goToNote(note.id)}>
              <Icon d={ICON.note} />
              <span className="note-link-text">
                <span className="task-title">{note.title.trim() || 'Nota'}</span>
                {notePreview(note) && <span className="task-sub">{notePreview(note)}</span>}
              </span>
              <span className="chev" aria-hidden>›</span>
            </button>
          )}
        </>
      )}

      {editing && (
        <>
          <label className="field">Descripción
            <textarea rows={2} placeholder="Para qué la haces, cómo, cuánto rato…" defaultValue={daily.description ?? ''} onBlur={(e) => e.target.value !== (daily.description ?? '') && set({ description: e.target.value.trim() || null })} />
          </label>

          <label className="field">Proyecto
            <select value={daily.project_id ?? ''} onChange={(e) => setProject(e.target.value || null)}>
              <option value="">Ninguno</option>
              {projects.filter((p) => p.status !== 'hecho' || p.id === daily.project_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <div className="field">Color
            <div className="color-picker">
              {Object.entries(DAILY_COLORS).map(([key, label]) => (
                <button key={key} type="button" className={`swatch dc-${key} ${(daily.color || 'none') === key ? 'on' : ''}`} onClick={() => set({ color: key })} aria-label={label} title={label} />
              ))}
            </div>
          </div>

          <IconPicker icon={daily.icon} onChange={(icon) => set({ icon })} label="Imagen (opcional)" />

          <div className="field">Nota
            {note
              ? <button className="secondary" onClick={() => goToNote(note.id)}>Abrir su nota</button>
              : <button className="secondary" onClick={() => noteFromDaily(daily).then((n) => goToNote(n.id))}>Añadir una nota</button>}
            <span className="hint">La nota sale también en Notas y en el proyecto.</span>
          </div>

          <button className="ghost danger" onClick={() => confirm(`¿Borrar «${daily.title}»? Se pierde su racha y su calendario; su nota se queda.`) && remove('daily_tasks', daily.id).then(onClose)}>Borrar tarea diaria</button>
        </>
      )}
    </Sheet>
  )
}

/** «＋» in Tareas → Diarias: the name; then its page opens in edit mode for the rest. */
export function NewDaily({ onClose }: { onClose: () => void }) {
  const { daily_tasks } = useData()
  const [title, setTitle] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const daily = daily_tasks.find((d) => d.id === created)
  if (daily) return <DailySheet daily={daily} onClose={onClose} startEditing />
  const create = async () => {
    if (!title.trim()) return
    const [d] = await insert('daily_tasks', [{ title: title.trim(), position: daily_tasks.length, ...NEW_DAILY }])
    setCreated(d.id)
  }
  return (
    <Sheet title="Nueva tarea diaria" onClose={onClose}>
      <form className="form" onSubmit={(e) => (e.preventDefault(), create())}>
        <input className="big-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ir al gimnasio, leer 10 minutos…" autoFocus maxLength={200} aria-label="Nombre" />
        <button className="primary" disabled={!title.trim()}>Crear y personalizar</button>
      </form>
    </Sheet>
  )
}

/** Rename, reorder and delete daily tasks. Each change is saved at once. */
function EditDaily({ list, onClose }: { list: DailyTask[]; onClose: () => void }) {
  // Swap positions with the neighbour (positions are renumbered so equal or missing ones can't get stuck).
  const move = (i: number, by: number) => {
    const order = [...list]
    ;[order[i], order[i + by]] = [order[i + by], order[i]]
    return Promise.all(order.map((d, position) => d.position !== position && update('daily_tasks', d.id, { position })))
  }
  return (
    <Sheet title="Ordenar diarias" onClose={onClose}>
      <ul className="list card-list edit-daily">
        {list.map((d, i) => (
          <li key={d.id}>
            <input defaultValue={d.title} onBlur={(e) => e.target.value.trim() && e.target.value !== d.title && update('daily_tasks', d.id, { title: e.target.value.trim() })} aria-label="Nombre" />
            <button className="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
            <button className="ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
            <button className="ghost danger" onClick={() => confirm(`¿Quitar «${d.title}»? Se pierde su racha.`) && remove('daily_tasks', d.id)} aria-label={`Quitar «${d.title}»`}><Icon d={ICON.x} /></button>
          </li>
        ))}
      </ul>
      <p className="hint">Para lo demás (imagen, color, proyecto…) abre la diaria y toca el lápiz.</p>
    </Sheet>
  )
}
