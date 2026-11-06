// Pure rules of the app (no React, no Supabase), so they can be tested in logic.test.ts.
import type { ChecklistItem, DailyTask, Effort, FpTest, Note, Priority, Shift, ShiftKind, Task } from './types'

// ---------- time zone ----------
// Every «today», «tomorrow» and time below is in the user's time zone (saved in their profile), not the device's
// and not the server's. Until the profile loads (and in tests) it's Madrid.
const DEFAULT_TZ = 'Europe/Madrid'
let tz = DEFAULT_TZ

export function validTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone) return false
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true } catch { return false }
}
/** The phone's own time zone, saved in the profile when the account is created. */
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ
export const setTimeZone = (zone: string | null | undefined) => { tz = validTimeZone(zone) ? zone : DEFAULT_TZ }
export const timeZone = () => tz

/** 'YYYY-MM-DD' in the user's time zone. */
export function localDay(d = new Date(), zone = tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Minutes since midnight in the user's time zone. */
export function localMinutes(d = new Date(), zone = tz) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).split(':').map(Number)
  return h * 60 + m
}

// Dates as plain calendar days: noon UTC avoids any daylight-saving surprise when adding days.
const asDate = (day: string) => new Date(`${day}T12:00:00Z`)
export const addDays = (day: string, n: number) => {
  const d = asDate(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (from: string, to: string) => Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86_400_000)
/** 0 = Monday … 6 = Sunday */
export const weekday = (day: string) => (asDate(day).getUTCDay() + 6) % 7
export const mondayOf = (day: string) => addDays(day, -weekday(day))
export const weekOf = (day: string) => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(day), i))

const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const dayName = (day: string) => DAY_NAMES[weekday(day)]
export const shortDate = (day: string) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`
export const longDate = (day: string) => `${dayName(day)} ${shortDate(day)}`
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** "martes, 3 de noviembre" */
export const fullDate = (day: string) => `${dayName(day)}, ${Number(day.slice(8))} de ${MONTHS_LONG[Number(day.slice(5, 7)) - 1]}`

/** "Hoy", "Mañana", "Ayer", "viernes", "hace 3 días", "12 nov". */
export function relDay(day: string, today: string) {
  const n = daysBetween(today, day)
  if (n === 0) return 'Hoy'
  if (n === 1) return 'Mañana'
  if (n === -1) return 'Ayer'
  if (n < 0) return `Hace ${-n} días`
  if (n < 7) return dayName(day)
  return shortDate(day)
}

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Usual hours of each shift at the restaurant. Night ends at closing: 23:00, Saturday 24:00. */
export function shiftHours(kind: ShiftKind, day: string): { starts_at: string | null; ends_at: string | null } {
  switch (kind) {
    case 'opening': return { starts_at: '10:00', ends_at: '17:30' }
    case 'dia': return { starts_at: '11:40', ends_at: '17:30' }
    case 'noche': return { starts_at: '17:00', ends_at: weekday(day) === 5 ? '24:00' : '23:00' }
    case 'libre': return { starts_at: null, ends_at: null }
  }
}

// The day counts from the 9:30 summary until 23:30.
const DAY_START = toMin('09:30')
const DAY_END = toMin('23:30')
const GET_READY = 30 // minutes before a shift to get there

/**
 * What today looks like: the headline, whether it's a work day, and `line`, the same in a sentence under the greeting on Hoy.
 */
export function dayPlan(shift: Shift | undefined) {
  if (!shift || shift.kind === 'libre' || !shift.starts_at || !shift.ends_at) {
    return { work: false, title: 'Libre', free: 'Todo el día libre', line: 'Hoy no trabajas: tienes el día libre.' }
  }
  const start = toMin(shift.starts_at)
  const end = toMin(shift.ends_at)
  const label = shiftLabel(shift.kind)
  const title = `Turno ${label} · ${hhmm(shift.starts_at)}–${hhmm(shift.ends_at)}`
  const before = start - GET_READY - DAY_START
  const after = DAY_END - end
  // Whichever gap is bigger is the one worth planning around.
  if (before >= after && before >= 60) {
    const until = fromMin(start - GET_READY)
    return { work: true, title, free: `Libre hasta las ${until}`, line: `Turno ${label} a las ${hhmm(shift.starts_at)}. Libre hasta las ${until}.` }
  }
  if (after > before && after >= 60) {
    return { work: true, title, free: `Libre desde las ${hhmm(shift.ends_at)}`, line: `Turno ${label} hasta las ${hhmm(shift.ends_at)}. Libre después.` }
  }
  return { work: true, title, free: 'Sin hueco libre', line: `Turno ${label} de ${hhmm(shift.starts_at)} a ${hhmm(shift.ends_at)}. Hoy queda poco hueco.` }
}
const shiftLabel = (k: ShiftKind) => ({ opening: 'de opening', dia: 'de día', noche: 'de noche', libre: 'libre' })[k]

const PRIORITY_RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 }
const EFFORT_RANK: Record<Effort, number> = { rapido: 0, medio: 1, grande: 2 }

/** Nearest deadline first (no deadline last), then high priority, then quick effort, then oldest. */
export function byPriority(a: Task, b: Task) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : 1
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort]
    || (a.due_time ?? '99').localeCompare(b.due_time ?? '99')
    || a.created_at.localeCompare(b.created_at)
}

export const FOCUS_SIZE = 3

/** Foco = the 3 first open tasks; everything else open (and anything waiting) can wait. */
export function splitToday(tasks: Task[]) {
  const active = tasks.filter((t) => t.status === 'abierto' || t.status === 'en_curso').sort(byPriority)
  const focus = active.slice(0, FOCUS_SIZE)
  return { focus, later: active.slice(FOCUS_SIZE), waiting: tasks.filter((t) => t.status === 'esperando') }
}

/** The next block of FP tests to open: the nearest future opening date and its unread units. */
export function nextFpBlock(tests: FpTest[], today: string) {
  const next = tests.map((t) => t.opens_on).filter((d): d is string => !!d && d > today).sort()[0]
  if (!next) return null
  const block = tests.filter((t) => t.opens_on === next)
  return {
    opensOn: next,
    days: daysBetween(today, next),
    unread: block.filter((t) => !t.read).length,
    units: block.length,
    subjects: [...new Set(block.map((t) => t.subject))],
  }
}

/** The hello on Hoy, by the user's hour. */
export function greeting(minutes = localMinutes()) {
  const h = Math.floor(minutes / 60)
  return h >= 6 && h < 13 ? 'Buenos días' : h >= 13 && h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

// ---------- daily tasks ----------

/** What the list starts with the first time (the old «Si te sobra tiempo»). */
export const DEFAULT_DAILY = ['Ir al gimnasio', 'Una lección de Busuu', 'Una película pendiente', 'Algo de programación']

/** Ticked only on the day it was ticked: the next day it comes back unticked, with no job resetting anything. */
export const doneToday = (d: DailyTask, today: string) => d.done_on === today
/** The daily task this note belongs to, if any (shown as «Nota de tarea diaria» in Notas and in projects). */
export const dailyOfNote = (daily: DailyTask[], noteId: string) => daily.find((d) => d.note_id === noteId)

/**
 * Weekly streak: how many weeks in a row (Monday to Sunday) it was done at least once.
 * This week only counts once it's done; until Sunday, not having done it yet doesn't break the streak.
 */
export function weeklyStreak(days: string[], today: string) {
  const weeks = new Set(days.map(mondayOf))
  let week = mondayOf(today)
  if (!weeks.has(week)) week = addDays(week, -7)
  let n = 0
  while (weeks.has(week)) { n++; week = addDays(week, -7) }
  return n
}
export const byPosition = (a: DailyTask, b: DailyTask) => a.position - b.position || a.created_at.localeCompare(b.created_at)

// ---------- notes ----------

/** Text → checklist (one item per non-empty line) and back, as Keep's "Mostrar casillas". */
export const toChecklist = (body: string): ChecklistItem[] =>
  body.split('\n').map((l) => l.trim()).filter(Boolean).map((text) => ({ text, done: false }))
export const fromChecklist = (items: ChecklistItem[]) => items.map((i) => i.text).filter(Boolean).join('\n')

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** Search in title, text and checklist, ignoring accents and case ("cancion" finds "Canción"). */
export function noteMatches(n: Note, query: string) {
  const q = fold(query.trim())
  if (!q) return true
  return fold([n.title, n.body, ...(n.items ?? []).map((i) => i.text)].join('\n')).includes(q)
}

/** The second line of a row in the list: the first line of text that isn't the title. */
export function notePreview(n: Note) {
  const lines = n.items ? n.items.map((i) => i.text) : n.body.split('\n')
  return lines.map((l) => l.trim()).find(Boolean) ?? ''
}

/** Like iOS Notes: "10:42" today, "Ayer", the day name this week, "3 nov" before. */
export function noteTime(iso: string, now = new Date()) {
  const d = new Date(iso)
  const n = daysBetween(localDay(d), localDay(now))
  if (n === 0) return new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d)
  if (n === 1) return 'Ayer'
  if (n < 7) return dayName(localDay(d))
  return shortDate(localDay(d))
}

/** Most recently edited first. */
export const byEdited = (a: Note, b: Note) => b.updated_at.localeCompare(a.updated_at)

// ---------- notifications (api/tick.ts) ----------
/** When the morning summary goes out (user's time). Until noon it still catches up if a tick was missed. */
export const SUMMARY_FROM = 9 * 60 + 30
export const SUMMARY_UNTIL = 12 * 60

/**
 * Reminders whose day and time (in `zone`, the user's) have arrived. Only those from yesterday on: a reminder that was
 * already old when notifications were switched on shouldn't ring now.
 */
export function dueReminders(tasks: Task[], now = new Date(), zone = tz) {
  const today = localDay(now, zone)
  const stamp = `${today} ${fromMin(localMinutes(now, zone))}`
  const yesterday = addDays(today, -1)
  return tasks.filter((t) =>
    (t.status === 'abierto' || t.status === 'en_curso') && t.due_date && t.due_time &&
    t.due_date >= yesterday && `${t.due_date} ${hhmm(t.due_time)}` <= stamp)
}

/** The 9:30 notification: how the day looks (only with the shifts module), then the first priorities. */
export function morningSummary(tasks: Task[], shift: Shift | undefined, name: string | null, withShifts = true) {
  const { focus, later } = splitToday(tasks)
  const plan = withShifts ? dayPlan(shift) : { line: '' }
  const list = focus.length ? `Prioridades: ${focus.map((t, i) => `${i + 1}. ${t.title}`).join(' · ')}` : 'Nada urgente para hoy.'
  const more = later.length ? ` (y ${later.length} más que pueden esperar)` : ''
  return { title: name ? `Buenos días, ${name}` : 'Buenos días', body: `${plan.line} ${list}${more}`.trim() }
}

// ---------- Google Calendar ----------
/**
 * Google's own «new event» link, filled in: it opens the user's Google Calendar (web or app) and one tap on
 * Guardar adds it. No sign-in with Google, no permissions, nothing for Google to review. With a time it's a
 * 30-minute event in the user's time zone; with only a day, an all-day event.
 */
export function googleCalendarUrl(t: Pick<Task, 'title' | 'notes' | 'due_date' | 'due_time'>) {
  if (!t.due_date) return null
  const day = t.due_date.replace(/-/g, '')
  let dates: string
  if (t.due_time) {
    const start = toMin(t.due_time)
    const end = start + 30
    const endDay = end >= 24 * 60 ? addDays(t.due_date, 1).replace(/-/g, '') : day
    dates = `${day}T${fromMin(start).replace(':', '')}00/${endDay}T${fromMin(end % (24 * 60)).replace(':', '')}00`
  } else {
    dates = `${day}/${addDays(t.due_date, 1).replace(/-/g, '')}`
  }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: t.title, dates, ctz: tz, details: [t.notes, 'Apuntado en Cuadre'].filter(Boolean).join('\n\n') })
  return `https://calendar.google.com/calendar/render?${q}`
}
