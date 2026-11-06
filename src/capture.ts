// Shared by the app and api/capture.ts: what the AI must return, the prompt, and the clean-up of its answer.
import { addDays, dayName, shiftHours, weekOf, weekday } from './logic.js' // .js: Node on Vercel needs the extension (Vite maps it to logic.ts)
import type { Effort, Priority, ShiftKind, Status } from './types'

export interface CapturedTask {
  title: string
  priority: Priority
  effort: Effort
  status: Status
  due_date: string | null
  due_time: string | null
  area: string | null
  /** Extra detail said with it (goes to the task's «Detalles»). */
  details: string | null
  project: string | null
  /** It looks like part of a project but the AI isn't sure which: the review asks. */
  ask_project: boolean
}
/** Something to keep, not to do: an idea, a list, a fact. `items` makes it a checklist. */
export interface CapturedNote { title: string; body: string; items: string[] | null; project: string | null; ask_project: boolean }
/** Something done every day («todos los días», «a diario»). */
export interface CapturedDaily { title: string; project: string | null; ask_project: boolean }
export interface CapturedShift { day: string; kind: ShiftKind; starts_at: string | null; ends_at: string | null }
export interface CapturedTest { subject: string; block: number | null; unit: string; opens_on: string | null; closes_on: string | null }
export interface CapturedProject { name: string; next_step: string | null; area: string | null }

export interface Capture {
  tasks: CapturedTask[]
  notes: CapturedNote[]
  daily_tasks: CapturedDaily[]
  shifts: CapturedShift[]
  fp_tests: CapturedTest[]
  projects: CapturedProject[]
  /** Anything the AI couldn't place, said back in one sentence. */
  note: string | null
}

/** What the app sends to POST /api/capture. `media` = base64 photo or recording. */
export interface CaptureRequest {
  text?: string
  media?: { mime: string; data: string }
  projects?: string[]
}

export function buildCapturePrompt(today: string, projects: string[]) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i)).map((d) => `${dayName(d)} ${d}`).join(', ')
  const thisWeek = weekOf(today)
  return `Eres Horacio, el asistente de prioridades de Victor (español, Madrid). Convierte lo que te manda (texto, audio o foto) en datos.

Hoy es ${dayName(today)} ${today}. Próximos días: ${days}.
Semana actual (lunes a domingo): ${thisWeek[0]} a ${thisWeek[6]}.
Proyectos que ya tiene: ${projects.length ? projects.join('; ') : 'ninguno'}.

Qué puede ser:
Primero decide qué es cada cosa:
- Recordatorio: «recuérdame», «avísame», «que no se me olvide» o algo a una hora concreta. Va en tasks con due_date y due_time (si no dice hora pero sí día, due_time null).
- Tarea: algo que hacer, sin hora fija. Va en tasks.
- Nota (notes): algo para guardar, no para hacer: una idea, un dato, apuntes, una lista (de la compra, de pelis…). title corto; body el texto; si es una lista, items con un elemento por línea y body vacío. «Apunta que…», «nota:», «idea:» son notas.
- Tarea diaria (daily_tasks): algo que quiere hacer cada día («todos los días», «a diario», «cada mañana»). title, y project/ask_project como las tareas.
- Ante la duda entre tarea y nota: si hay que hacer algo, tarea; si es para recordar o consultar, nota.

Proyecto de tareas, recordatorios, notas y tareas diarias: project = nombre exacto de un proyecto existente si encaja claramente (por tema o porque lo nombra). Si parece de algún proyecto pero no sabes de cuál, o podría ser un proyecto nuevo, project null y ask_project true. Si no tiene que ver con ningún proyecto (la compra, una llamada), project null y ask_project false.

Campos:
- Tareas y recordatorios (tasks): title breve en infinitivo («Sacar el dinero del alquiler»). priority: alta si dice urgente/importante/ya, baja si dice cuando pueda/sin prisa, si no media. effort: rapido (<15 min), medio, grande (varias horas). due_date YYYY-MM-DD si dice un día («mañana», «el viernes» = el próximo viernes); due_time HH:MM si dice una hora. status: abierto salvo que diga que ya lo está haciendo (en_curso) o que espera a alguien (esperando). details: detalles extra que diga, si los hay.
- Turnos del restaurante (shifts), normalmente de una foto del horario semanal: una fila por día de la semana que se ve, solo los de Victor. kind: opening (10:00-17:30), dia (11:40-17:30), noche (17:00 o 17:30 hasta cierre 23:00; sábado 24:00) o libre (día vacío o libre). Pon starts_at/ends_at HH:MM según lo que ponga; si pone «cierre» usa 23:00 (sábado 24:00).
- Tests del FP (fp_tests): subject (materia), block (número de bloque), unit (la unidad, p. ej. «U3 - Nóminas»), opens_on y closes_on YYYY-MM-DD. Una fila por unidad.
- Proyectos nuevos (projects): solo si dice claramente que empieza un proyecto. name, next_step (siguiente paso concreto).

Si algo no encaja o no se entiende, explícalo en note (una frase). Sin inventar: si no hay nada, listas vacías.`
}

// JSON schema for Gemini's structured output (OpenAPI subset): the answer always has this shape.
const str = { type: 'STRING' }
const nstr = { type: 'STRING', nullable: true }
const list = (properties: Record<string, object>, required: string[]) => ({ type: 'ARRAY', items: { type: 'OBJECT', properties, required } })
export const CAPTURE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tasks: list({
      title: str,
      priority: { type: 'STRING', enum: ['alta', 'media', 'baja'] },
      effort: { type: 'STRING', enum: ['rapido', 'medio', 'grande'] },
      status: { type: 'STRING', enum: ['abierto', 'en_curso', 'esperando'] },
      due_date: nstr, due_time: nstr, area: nstr, details: nstr, project: nstr, ask_project: { type: 'BOOLEAN' },
    }, ['title', 'priority', 'effort', 'status']),
    notes: list({ title: str, body: str, items: { type: 'ARRAY', items: str, nullable: true }, project: nstr, ask_project: { type: 'BOOLEAN' } }, ['title', 'body']),
    daily_tasks: list({ title: str, project: nstr, ask_project: { type: 'BOOLEAN' } }, ['title']),
    shifts: list({ day: str, kind: { type: 'STRING', enum: ['opening', 'dia', 'noche', 'libre'] }, starts_at: nstr, ends_at: nstr }, ['day', 'kind']),
    fp_tests: list({ subject: str, block: { type: 'INTEGER', nullable: true }, unit: str, opens_on: nstr, closes_on: nstr }, ['subject', 'unit']),
    projects: list({ name: str, next_step: nstr, area: nstr }, ['name']),
    note: nstr,
  },
  required: ['tasks', 'notes', 'daily_tasks', 'shifts', 'fp_tests', 'projects'],
}

const DATE = /^\d{4}-\d\d-\d\d$/
const TIME = /^([01]\d|2[0-4]):[0-5]\d$/
const date = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : null)
const time = (v: unknown) => (typeof v === 'string' && TIME.test(v.slice(0, 5)) ? v.slice(0, 5) : null)
const text = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T) => (allowed.includes(v as T) ? (v as T) : fallback)
const arr = (v: unknown) => (Array.isArray(v) ? v.slice(0, 40) : []) as Record<string, unknown>[]

/** Never trust the model's JSON blindly: keep only valid fields, fill defaults, drop empty rows. */
export function cleanCapture(raw: unknown): Capture {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    tasks: arr(r.tasks).flatMap((t) => {
      const title = text(t.title)
      return title ? [{
        title,
        priority: oneOf(t.priority, ['alta', 'media', 'baja'] as const, 'media'),
        effort: oneOf(t.effort, ['rapido', 'medio', 'grande'] as const, 'medio'),
        status: oneOf(t.status, ['abierto', 'en_curso', 'esperando'] as const, 'abierto'),
        due_date: date(t.due_date),
        due_time: time(t.due_time),
        area: text(t.area, 40),
        details: text(t.details, 1000),
        project: text(t.project, 80),
        ask_project: t.ask_project === true,
      }] : []
    }),
    notes: arr(r.notes).flatMap((n) => {
      const items = Array.isArray(n.items) ? n.items.map((i) => text(i)).filter((i): i is string => !!i).slice(0, 60) : []
      const body = text(n.body, 5000) ?? ''
      const title = text(n.title, 120) ?? ''
      return title || body || items.length ? [{ title, body, items: items.length ? items : null, project: text(n.project, 80), ask_project: n.ask_project === true }] : []
    }),
    daily_tasks: arr(r.daily_tasks).flatMap((d) => {
      const title = text(d.title, 120)
      return title ? [{ title, project: text(d.project, 80), ask_project: d.ask_project === true }] : []
    }),
    shifts: arr(r.shifts).flatMap((s) => {
      const day = date(s.day)
      if (!day) return []
      const kind = oneOf(s.kind, ['opening', 'dia', 'noche', 'libre'] as const, 'libre')
      const usual = shiftHours(kind, day)
      return [{ day, kind, starts_at: kind === 'libre' ? null : time(s.starts_at) ?? usual.starts_at, ends_at: kind === 'libre' ? null : time(s.ends_at) ?? usual.ends_at }]
    }),
    fp_tests: arr(r.fp_tests).flatMap((t) => {
      const subject = text(t.subject, 80)
      const unit = text(t.unit, 120)
      return subject && unit ? [{ subject, unit, block: Number.isInteger(t.block) ? (t.block as number) : null, opens_on: date(t.opens_on), closes_on: date(t.closes_on) }] : []
    }),
    projects: arr(r.projects).flatMap((p) => {
      const name = text(p.name, 80)
      return name ? [{ name, next_step: text(p.next_step), area: text(p.area, 40) }] : []
    }),
    note: text(r.note, 300),
  }
}

/**
 * Canned answer for AI_PROVIDER=mock (no key, no cost): enough to try the whole flow.
 * Text → one item, by its first words: «nota/idea/lista…» a note, «todos los días/a diario» a daily task,
 * otherwise a task («mañana», «urgente», «a las 18:00» understood; «recuérdame» or a time makes it a reminder).
 * A project's name in the text picks that project; the word «proyecto» without one makes the review ask.
 * A photo → this week's shifts.
 */
export function mockCapture(req: CaptureRequest, today: string): Capture {
  const empty: Capture = { tasks: [], notes: [], daily_tasks: [], shifts: [], fp_tests: [], projects: [], note: null }
  if (req.media?.mime.startsWith('image/')) {
    const kinds: ShiftKind[] = ['libre', 'noche', 'noche', 'opening', 'dia', 'noche', 'libre']
    return { ...empty, note: '(Simulado) Así leería la IA una foto del horario.', shifts: weekOf(today).map((day) => ({ day, kind: kinds[weekday(day)], ...shiftHours(kinds[weekday(day)], day) })) }
  }
  const t = (req.text ?? '').trim() || '(audio) Llamar al casero'
  const lower = t.toLowerCase()
  const project = (req.projects ?? []).find((p) => lower.includes(p.toLowerCase())) ?? null
  const ask_project = !project && lower.includes('proyecto')
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  if (/^(nota|idea|apunta|lista)\b/.test(lower)) {
    const [head, ...rest] = t.replace(/^(nota|idea|apunta( que)?|lista( de)?)[:,]?\s*/i, '').split(/[:\n]/)
    const items = lower.startsWith('lista') ? rest.join(',').split(',').map((s) => s.trim()).filter(Boolean) : []
    return { ...empty, notes: [{ title: cap(head.trim()), body: items.length ? '' : rest.join(':').trim(), items: items.length ? items : null, project, ask_project }] }
  }
  if (/todos los días|a diario|cada día/.test(lower)) {
    return { ...empty, daily_tasks: [{ title: cap(t.replace(/,?\s*(todos los días|a diario|cada día)/gi, '').trim()), project: null, ask_project: false }] }
  }
  const due_date = lower.includes('pasado mañana') ? addDays(today, 2) : lower.includes('mañana') ? addDays(today, 1) : lower.includes('hoy') ? today : null
  const hour = lower.match(/a las (\d{1,2})(?::(\d\d))?/)
  const title = t.replace(/^recuérdame( que)?\s*/i, '').replace(/,?\s*(pasado mañana|mañana|hoy|urgente|a las \d{1,2}(:\d\d)?)\b/gi, '').trim()
  return {
    ...empty,
    tasks: [{
      title: cap(title),
      priority: lower.includes('urgente') ? 'alta' : 'media',
      effort: 'medio',
      status: 'abierto',
      due_date: due_date ?? (lower.startsWith('recuérdame') ? today : null),
      due_time: hour ? `${hour[1].padStart(2, '0')}:${hour[2] ?? '00'}` : null,
      area: null,
      details: null,
      project,
      ask_project,
    }],
  }
}
