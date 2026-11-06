// Where the data lives. With VITE_SUPABASE_URL/KEY: Supabase (the source of truth, see supabase/setup.sql).
// Without them: "demo mode", saved in this browser's localStorage, to try the app before creating the project.
import { useSyncExternalStore } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { addDays, madridDay } from './logic'
import type { DailyLog, DailyTask, FpTest, Note, Project, Shift, Task } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined
export const demo = !(url && key)
// The publishable key is meant to be public: Row Level Security decides what each user can see.
export const supa = demo ? null : createClient(url!, key!)

type Table = 'tasks' | 'projects' | 'shifts' | 'fp_tests' | 'notes' | 'daily_tasks'
type RowOf = { tasks: Task; projects: Project; shifts: Shift; fp_tests: FpTest; notes: Note; daily_tasks: DailyTask }
export interface Data { tasks: Task[]; closed: Task[]; projects: Project[]; shifts: Shift[]; fp_tests: FpTest[]; notes: Note[]; daily_tasks: DailyTask[]; daily_log: DailyLog[]; loaded: boolean }

const EMPTY: Omit<Data, 'loaded' | 'closed'> = { tasks: [], projects: [], shifts: [], fp_tests: [], notes: [], daily_tasks: [], daily_log: [] }
let data: Data = { ...EMPTY, closed: [], loaded: false }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

/** The whole app reads from here; any change re-renders the screens that use it. */
export const useData = () => useSyncExternalStore(subscribe, () => data)

// ---------- demo backend (localStorage) ----------
const DEMO_KEY = 'horacio-demo'
const demoAll = (): Omit<Data, 'loaded' | 'closed'> => {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}') }
  } catch {
    return { ...EMPTY }
  }
}
const demoSave = (d: Omit<Data, 'loaded' | 'closed'>) => localStorage.setItem(DEMO_KEY, JSON.stringify(d))

// Only what the screens need: unfinished tasks, shifts from last week on, every note and daily task. Small enough to load all at once.
const OPEN = ['abierto', 'en_curso', 'esperando']
const CLOSED = ['hecho', 'descartado']
/** Finished and discarded tasks stay this many days in «Terminadas», then purgeClosed() deletes them. */
export const KEEP_CLOSED_DAYS = 7
const closedCutoff = () => new Date(Date.now() - KEEP_CLOSED_DAYS * 86_400_000).toISOString()
const byDoneDesc = (a: Task, b: Task) => (b.done_at ?? '').localeCompare(a.done_at ?? '')

export async function load() {
  const since = addDays(madridDay(), -7)
  if (!supa) {
    const d = demoAll()
    const cutoff = closedCutoff()
    data = { ...d, tasks: d.tasks.filter((t) => OPEN.includes(t.status)), closed: d.tasks.filter((t) => CLOSED.includes(t.status) && (t.done_at ?? '') >= cutoff).sort(byDoneDesc), shifts: d.shifts.filter((s) => s.day >= since), loaded: true }
    return emit()
  }
  const [tasks, closed, projects, shifts, tests, notes, daily, log] = await Promise.all([
    supa.from('tasks').select('*').in('status', OPEN),
    supa.from('tasks').select('*').in('status', CLOSED).gte('done_at', closedCutoff()).order('done_at', { ascending: false }),
    supa.from('projects').select('*').order('created_at'),
    supa.from('shifts').select('*').gte('day', since).order('day'),
    supa.from('fp_tests').select('*').order('opens_on').order('unit'),
    supa.from('notes').select('*'),
    supa.from('daily_tasks').select('*').order('position'),
    // A year of ticks is plenty for the streaks (a few hundred tiny rows).
    supa.from('daily_log').select('daily_id, day').gte('day', addDays(madridDay(), -371)),
  ])
  const error = tasks.error ?? closed.error ?? projects.error ?? shifts.error ?? tests.error ?? notes.error ?? daily.error ?? log.error
  if (error) throw new Error(error.message.includes('does not exist') ? 'Faltan las tablas: ejecuta supabase/setup.sql' : error.message)
  data = { tasks: tasks.data ?? [], closed: closed.data ?? [], projects: projects.data ?? [], shifts: shifts.data ?? [], fp_tests: tests.data ?? [], notes: notes.data ?? [], daily_tasks: daily.data ?? [], daily_log: log.data ?? [], loaded: true }
  emit()
}

const stamp = () => ({ id: crypto.randomUUID(), created_at: new Date().toISOString() })

/** Inserts rows and returns them with their ids. Shifts replace the one already saved for that day. */
export async function insert<T extends Table>(table: T, rows: Partial<RowOf[T]>[]): Promise<RowOf[T][]> {
  if (!rows.length) return []
  let saved: RowOf[T][]
  if (!supa) {
    const d = demoAll()
    saved = rows.map((r) => ({ ...stamp(), ...r }) as unknown as RowOf[T])
    const list = d[table] as unknown as RowOf[T][]
    const kept = table === 'shifts' ? list.filter((s) => !saved.some((n) => (n as Shift).day === (s as Shift).day)) : list
    ;(d[table] as unknown as RowOf[T][]) = [...kept, ...saved]
    demoSave(d)
  } else {
    const q = table === 'shifts'
      ? supa.from(table).upsert(rows as never[], { onConflict: 'user_id,day' })
      : supa.from(table).insert(rows as never[])
    const { data: out, error } = await q.select()
    if (error) throw new Error(error.message)
    saved = out as RowOf[T][]
  }
  await load()
  return saved
}

export async function update<T extends Table>(table: T, id: string, patch: Partial<RowOf[T]>) {
  if (!supa) {
    const d = demoAll()
    ;(d[table] as unknown as { id: string }[]) = (d[table] as unknown as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r))
    demoSave(d)
  } else {
    const { error } = await supa.from(table).update(patch as never).eq('id', id)
    if (error) throw new Error(error.message)
  }
  await load()
}

export async function remove(table: Table, id: string) {
  if (!supa) {
    const d = demoAll()
    ;(d[table] as unknown as { id: string }[]) = (d[table] as unknown as { id: string }[]).filter((r) => r.id !== id)
    demoSave(d)
  } else {
    const { error } = await supa.from(table).delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
  await load()
}

/** A new note (with every field, so demo mode stores the same shape as Supabase). */
export async function createNote(patch: Partial<Note> = {}) {
  const now = new Date().toISOString()
  const [n] = await insert('notes', [{ title: '', body: '', items: null, color: 'none', project_id: null, pinned: false, archived: false, updated_at: now, ...patch }])
  return n
}

/** Tick or untick a daily task for today: done_on for Hoy, plus a row in daily_log for the streaks. */
export async function toggleDaily(d: DailyTask, today: string) {
  const done = d.done_on === today
  if (!supa) {
    const all = demoAll()
    all.daily_tasks = all.daily_tasks.map((x) => (x.id === d.id ? { ...x, done_on: done ? null : today } : x))
    all.daily_log = done ? all.daily_log.filter((l) => !(l.daily_id === d.id && l.day === today)) : [...all.daily_log, { daily_id: d.id, day: today }]
    demoSave(all)
  } else {
    const [a, b] = await Promise.all([
      supa.from('daily_tasks').update({ done_on: done ? null : today }).eq('id', d.id),
      done
        ? supa.from('daily_log').delete().eq('daily_id', d.id).eq('day', today)
        : supa.from('daily_log').upsert({ daily_id: d.id, day: today }, { onConflict: 'daily_id,day', ignoreDuplicates: true }),
    ])
    const error = a.error ?? b.error
    if (error) throw new Error(error.message.includes('daily_log') ? 'Falta la tabla daily_log: ejecuta supabase/setup.sql' : error.message)
  }
  await load()
}

/** Daily task → its note: starts with its title and project, and they stay linked. */
export async function noteFromDaily(d: DailyTask) {
  const n = await createNote({ title: d.title, project_id: d.project_id })
  await update('daily_tasks', d.id, { note_id: n.id })
  return n
}

/** A new task (a reminder is a task with a date). `note_id` links it to the note it came from. */
export const createTask = (t: Pick<Task, 'title'> & Partial<Task>) =>
  insert('tasks', [{ status: 'abierto', priority: 'media', effort: 'medio', notes: null, due_date: null, due_time: null, area: null, project_id: null, note_id: null, done_at: null, ...t }])

/** Reminder → note: the note starts with the reminder's title, notes and project, and they stay linked. */
export async function noteFromTask(t: Task) {
  const n = await createNote({ title: t.title, body: t.notes ?? '', project_id: t.project_id })
  await update('tasks', t.id, { note_id: n.id })
  return n
}

/** Finishing or discarding stamps done_at (the 7 days in «Terminadas» count from it); reopening clears it. */
export const setTaskStatus = (t: Task, status: Task['status']) =>
  update('tasks', t.id, { status, done_at: CLOSED.includes(status) ? new Date().toISOString() : null })

/**
 * Deletes tasks closed more than KEEP_CLOSED_DAYS ago (and old discarded ones from before done_at was stamped).
 * Called when the app opens or comes back, not on every change. RLS: only the user's own rows.
 */
export async function purgeClosed() {
  const cutoff = closedCutoff()
  if (!supa) {
    const d = demoAll()
    const kept = d.tasks.filter((t) => !CLOSED.includes(t.status) || (t.done_at ?? '') >= cutoff)
    if (kept.length !== d.tasks.length) demoSave({ ...d, tasks: kept })
    return
  }
  await supa.from('tasks').delete().in('status', CLOSED).or(`done_at.is.null,done_at.lt.${cutoff}`)
}

// ---------- session ----------
export async function currentSession(): Promise<Session | null> {
  return supa ? (await supa.auth.getSession()).data.session : null
}

// Email + password, with "Confirm email" turned off in Supabase (as in Músculo): no emails, no links.
export async function signIn(email: string, password: string) {
  const { error } = await supa!.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message.includes('Invalid login') ? 'Email o contraseña incorrectos' : error.message)
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supa!.auth.signUp({ email, password })
  if (error) throw new Error(error.message.includes('already registered') ? 'Ese email ya tiene cuenta: pulsa Entrar' : error.message)
  if (!data.session) throw new Error('Cuenta creada, pero Supabase pide confirmar el email: desactiva «Confirm email»')
}

export const signOut = () => supa?.auth.signOut()

/** Proves to our own server (api/capture.ts) who is signed in. */
export async function accessToken() {
  return (await currentSession())?.access_token
}
