// Pure rules of the app (no React, no Supabase), so they can be tested in logic.test.ts.
import type { ChecklistItem, DailyTask, Effort, FpTest, Note, Priority, Project, Shift, ShiftKind, Task } from './types'

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

/** Nearest deadline first (no deadline last), then high priority, then in-progress, then quick effort, then oldest. */
export function byPriority(a: Task, b: Task) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : 1
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || (a.status === 'en_curso' ? 0 : 1) - (b.status === 'en_curso' ? 0 : 1)
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
  return fold([n.title, stripImages(n.body), ...(n.items ?? []).map((i) => i.text)].join('\n')).includes(q)
}

/** The second line of a row in the list: the first line of text that isn't the title. */
export function notePreview(n: Note) {
  const lines = n.items ? n.items.map((i) => i.text) : stripImages(n.body).split('\n')
  return lines.map((l) => l.trim()).find(Boolean) ?? ''
}

// ---------- pictures inside a note ----------
// A picture is one line of the body, «[[img:<user>/<id>.webp]]», so the text stays plain text (search, AI, export)
// and no extra column is needed. The editor shows those lines as pictures between the text blocks.
const IMG_LINE = /^\[\[img:([A-Za-z0-9/_.-]{1,200})\]\]$/
export type Block = { type: 'text'; text: string } | { type: 'img'; path: string }

/** Body → alternating text and picture blocks. It always starts and ends with a text block (maybe empty), so there's somewhere to type. */
export function splitBody(body: string): Block[] {
  const blocks: Block[] = []
  let text: string[] = []
  for (const line of body.split('\n')) {
    const m = IMG_LINE.exec(line.trim())
    if (m) { blocks.push({ type: 'text', text: text.join('\n') }, { type: 'img', path: m[1] }); text = [] } else text.push(line)
  }
  blocks.push({ type: 'text', text: text.join('\n') })
  return blocks
}
export const joinBlocks = (blocks: Block[]) => blocks.map((b) => (b.type === 'img' ? `[[img:${b.path}]]` : b.text)).join('\n')
export const imagePaths = (body: string) => splitBody(body).flatMap((b) => (b.type === 'img' ? [b.path] : []))
/** The text without the picture lines (for search, previews and sharing). */
export const stripImages = (body: string) => body.split('\n').filter((l) => !IMG_LINE.test(l.trim())).join('\n').trim()

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

// ---------- tags ----------
export const MAX_TAGS = 10
/** «#Aprendizaje de idiomas» → «aprendizaje-de-idiomas»: lowercase, no accents, no #, words joined with -. */
export function cleanTag(s: string) {
  return fold(s).replace(/^#+/, '').trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
}
/** A search box's text: words starting with # are tags, the rest is plain text. */
export function parseSearch(query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  return {
    tags: words.filter((w) => w.startsWith('#')).map(cleanTag).filter(Boolean),
    text: words.filter((w) => !w.startsWith('#')).join(' '),
  }
}
/** The ids of the projects that have every tag searched. A tag matches by its start: #idio finds #idiomas. */
export function projectsTagged(projects: Pick<Project, 'id' | 'tags'>[], tags: string[]) {
  return new Set(projects.filter((p) => tags.every((t) => (p.tags ?? []).some((pt) => pt.startsWith(t)))).map((p) => p.id))
}
/** A task matches if it or its project has every tag searched (a tag matches by prefix: #idio finds #idiomas). */
export function taskMatchesTags(t: Pick<Task, 'tags' | 'project_id'>, tags: string[], taggedProjects?: Set<string> | null) {
  if (!tags.length) return true
  return tags.every((tag) => (t.tags ?? []).some((pt) => pt.startsWith(tag)) || (!!t.project_id && !!taggedProjects?.has(t.project_id)))
}
/** Every tag in use, for picking an existing one instead of typing it again. */
export const allTags = (...collections: ({ tags?: string[] | null }[])[]) =>
  [...new Set(collections.flat().flatMap((p) => p.tags ?? []))].sort()
/** Plain-text search in a few strings, ignoring accents and case. */
export const textMatches = (query: string, ...fields: (string | null | undefined)[]) => {
  const q = fold(query.trim())
  return !q || fold(fields.filter(Boolean).join('\n')).includes(q)
}

// ---------- colour + opacity ----------
// A task, project or daily task keeps its colour in one text field: «verde» (normal strength) or «verde:80» (opacity 0-100).
// 50 is how the colours looked before there was a slider, so it's the default and isn't written.
export const DEFAULT_TINT = 50
export function colorParts(c?: string | null): { key: string; alpha: number } {
  const [key, a] = (c ?? 'none').split(':')
  const n = a === undefined ? DEFAULT_TINT : Number(a)
  return { key: key || 'none', alpha: Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DEFAULT_TINT }
}
export const joinColor = (key: string, alpha: number) => (key === 'none' ? 'none' : alpha === DEFAULT_TINT ? key : `${key}:${alpha}`)
/** The colour name for the `dc-…` class, or null when there's none. */
export const colorKey = (c?: string | null) => { const { key } = colorParts(c); return key === 'none' ? null : key }
// The palette (same as .dc-* in styles.css) and what's behind a coloured card in each theme, to pick readable text.
const TILE: Record<string, [number, number, number]> = {
  azul: [0x3b, 0x76, 0xd9], verde: [0x2f, 0x9a, 0x63], morado: [0x7c, 0x5a, 0xd6], rosa: [0xd4, 0x50, 0x8a],
  rojo: [0xd6, 0x51, 0x51], naranja: [0xdf, 0x7a, 0x2a], vinotinto: [0x9b, 0x2a, 0x4c], gris: [0x6b, 0x76, 0x85],
}
const PAGE = { light: { row: [255, 255, 255], tile: [243, 245, 249] }, dark: { row: [28, 28, 30], tile: [18, 18, 18] } } as const
const BASE = { row: 14, tile: 24 } // how much colour the card has at the default opacity (%), see styles.css
const luminance = ([r, g, b]: number[]) => {
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
/** White or dark text, whichever reads better on the card's real colour (the tint blended over the page). */
function inkFor(key: string, alpha: number, theme: 'light' | 'dark', kind: 'row' | 'tile'): string {
  const tile = TILE[key]
  if (!tile) return ''
  const lo = Math.min(alpha / DEFAULT_TINT, 1), hi = Math.max((alpha - DEFAULT_TINT) / DEFAULT_TINT, 0)
  const cover = (BASE[kind] * lo + (100 - BASE[kind]) * hi) / 100
  const page = PAGE[theme][kind]
  const bg = tile.map((t, i) => t * cover + page[i] * (1 - cover))
  const L = luminance(bg)
  const white = 1.05 / (L + 0.05), dark = (L + 0.05) / (luminance([14, 26, 43]) + 0.05) // contrast against white and against the dark ink
  return white * 1.5 >= dark ? '#ffffff' : '#0e1a2b' // leans to white: on a saturated colour it looks right even when dark text measures a little higher
}

/** Inline style for a coloured card: how strong the tint is (--lo/--hi, blended in the CSS) and the text colour that reads on it (--ink-l/--ink-d, one per theme). */
export const tintStyle = (c?: string | null, kind: 'row' | 'tile' = 'tile'): { [k: string]: string | number } | undefined => {
  const { key, alpha } = colorParts(c)
  if (key === 'none') return undefined
  const ink = { '--ink-l': inkFor(key, alpha, 'light', kind), '--ink-d': inkFor(key, alpha, 'dark', kind) }
  // 0-50 fades from clear to the usual look (--lo 0→1); 50-100 goes on to the solid palette colour (--hi 0→1).
  return { '--lo': Math.min(alpha / DEFAULT_TINT, 1), '--hi': Math.max((alpha - DEFAULT_TINT) / DEFAULT_TINT, 0), ...ink }
}
