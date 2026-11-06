// Where the data lives. With VITE_SUPABASE_URL/KEY: Supabase (the source of truth, see supabase/setup.sql).
// Without them: "demo mode", saved in this browser's localStorage, to try the app before creating the project.
import { useSyncExternalStore } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { addDays, localDay, setTimeZone } from './logic'
import type { DailyLog, DailyTask, FpTest, Note, Profile, Project, Shift, Task } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined
export const demo = !(url && key)
// The publishable key is meant to be public: Row Level Security decides what each user can see.
export const supa = demo ? null : createClient(url!, key!)

type Table = 'tasks' | 'projects' | 'shifts' | 'fp_tests' | 'notes' | 'daily_tasks'
type RowOf = { tasks: Task; projects: Project; shifts: Shift; fp_tests: FpTest; notes: Note; daily_tasks: DailyTask }
export interface Data { tasks: Task[]; closed: Task[]; projects: Project[]; shifts: Shift[]; fp_tests: FpTest[]; notes: Note[]; daily_tasks: DailyTask[]; daily_log: DailyLog[]; profile: Profile | null; loaded: boolean }

const EMPTY: Omit<Data, 'loaded' | 'closed' | 'profile'> & { profile?: Profile | null } = { tasks: [], projects: [], shifts: [], fp_tests: [], notes: [], daily_tasks: [], daily_log: [] }
let data: Data = { ...EMPTY, closed: [], profile: null, loaded: false }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

/** The whole app reads from here; any change re-renders the screens that use it. */
export const useData = () => useSyncExternalStore(subscribe, () => data)

// ---------- demo backend (localStorage) ----------
const DEMO_KEY = 'cuadre-demo'
const demoAll = (): typeof EMPTY => {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(DEMO_KEY) ?? localStorage.getItem('horacio-demo') ?? '{}') }
  } catch {
    return { ...EMPTY }
  }
}
const demoSave = (d: typeof EMPTY) => localStorage.setItem(DEMO_KEY, JSON.stringify(d))

// Only what the screens need: unfinished tasks, shifts from last week on, every note and daily task. Small enough to load all at once.
const OPEN = ['abierto', 'en_curso', 'esperando']
const CLOSED = ['hecho', 'descartado']
/** Finished and discarded tasks stay this many days in «Terminadas», then purgeClosed() deletes them. */
export const KEEP_CLOSED_DAYS = 7
const closedCutoff = () => new Date(Date.now() - KEEP_CLOSED_DAYS * 86_400_000).toISOString()
const byDoneDesc = (a: Task, b: Task) => (b.done_at ?? '').localeCompare(a.done_at ?? '')

type Part = Exclude<keyof Data, 'loaded'>
type Result<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>
async function rows<T>(query: Result<T>, empty: T): Promise<T> {
  const { data: out, error } = await query
  if (error) throw new Error(error.message.includes('does not exist') ? 'Faltan tablas: ejecuta supabase/setup.sql' : error.message)
  return out ?? empty
}

/** How to read each part of Data from Supabase (RLS: only the user's rows). */
const FETCH: { [K in Part]: () => Promise<Data[K]> } = {
  tasks: () => rows(supa!.from('tasks').select('*').in('status', OPEN), []),
  closed: () => rows(supa!.from('tasks').select('*').in('status', CLOSED).gte('done_at', closedCutoff()).order('done_at', { ascending: false }), []),
  projects: () => rows(supa!.from('projects').select('*').order('created_at'), []),
  shifts: () => rows(supa!.from('shifts').select('*').gte('day', addDays(localDay(), -7)).order('day'), []),
  fp_tests: () => rows(supa!.from('fp_tests').select('*').order('opens_on').order('unit'), []),
  notes: () => rows(supa!.from('notes').select('*'), []),
  daily_tasks: () => rows(supa!.from('daily_tasks').select('*').order('position'), []),
  // A year of ticks is plenty for the streaks (a few hundred tiny rows).
  daily_log: () => rows(supa!.from('daily_log').select('daily_id, day').gte('day', addDays(localDay(), -371)), []),
  profile: () => rows(supa!.from('profiles').select('*').maybeSingle(), null),
}
const ALL = Object.keys(FETCH) as Part[]
/** What to read again after writing to a table: a task can move between open and «Terminadas». */
const PARTS_OF: Record<Table, Part[]> = { tasks: ['tasks', 'closed'], projects: ['projects'], shifts: ['shifts'], fp_tests: ['fp_tests'], notes: ['notes'], daily_tasks: ['daily_tasks'] }

/**
 * Reads only the parts that changed (1–2 queries) instead of everything (9): with many users this is what
 * keeps Supabase's free traffic (5 GB a month) from running out. Demo mode just rereads the browser.
 */
async function refresh(parts: Part[]) {
  if (!supa) return load()
  const values = await Promise.all(parts.map((p) => FETCH[p]()))
  const patch = Object.fromEntries(parts.map((p, i) => [p, values[i]])) as Partial<Data>
  if ('profile' in patch) setTimeZone(patch.profile?.timezone)
  data = { ...data, ...patch }
  emit()
}

/** Everything: when the app opens or comes back to the front. */
export async function load() {
  if (!supa) {
    const d = demoAll()
    const cutoff = closedCutoff()
    const since = addDays(localDay(), -7)
    setTimeZone(d.profile?.timezone)
    data = { ...d, profile: d.profile ?? null, tasks: d.tasks.filter((t) => OPEN.includes(t.status)), closed: d.tasks.filter((t) => CLOSED.includes(t.status) && (t.done_at ?? '') >= cutoff).sort(byDoneDesc), shifts: d.shifts.filter((s) => s.day >= since), loaded: true }
    return emit()
  }
  const parts = data.profile
    ? ALL.filter((p) => (p !== 'shifts' || data.profile!.shifts) && (p !== 'fp_tests' || data.profile!.fp))
    : ALL
  await refresh(parts)
  data = { ...data, loaded: true }
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
  await refresh(PARTS_OF[table])
  return saved
}

export async function update<T extends Table>(table: T, id: string, patch: Partial<RowOf[T]>) {
  const fullPatch = table === 'tasks' && ('due_date' in patch || 'due_time' in patch) && !('notified_at' in patch)
    ? { ...patch, notified_at: null }
    : patch
  if (!supa) {
    const d = demoAll()
    ;(d[table] as unknown as { id: string }[]) = (d[table] as unknown as { id: string }[]).map((r) => (r.id === id ? { ...r, ...fullPatch } : r))
    demoSave(d)
  } else {
    const { error } = await supa.from(table).update(fullPatch as never).eq('id', id)
    if (error) throw new Error(error.message)
  }
  await refresh(PARTS_OF[table])
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
  await refresh(PARTS_OF[table])
}

/** A new note (with every field, so demo mode stores the same shape as Supabase). */
export async function createNote(patch: Partial<Note> = {}) {
  const now = new Date().toISOString()
  const [n] = await insert('notes', [{ title: '', body: '', items: null, color: 'none', project_id: null, pinned: false, archived: false, updated_at: now, ...patch }])
  return n
}

/** Creates or changes the profile (welcome screen, Ajustes). */
export async function saveProfile(patch: Partial<Profile>) {
  if (!supa) {
    const d = demoAll()
    d.profile = { user_id: 'demo', name: null, timezone: 'Europe/Madrid', shifts: false, fp: false, ...d.profile, ...patch }
    demoSave(d)
  } else {
    const { error } = await supa.from('profiles').upsert(patch)
    if (error) throw new Error(error.message.includes('profiles') ? 'Falta la tabla profiles: ejecuta supabase/setup.sql' : error.message)
  }
  await refresh(['profile', 'shifts', ...(patch.fp ? ['fp_tests' as const] : [])]) // a new time zone moves «this week»
}

/** Tick or untick a daily task on `day` (today or a past day in the calendar): done_on for Hoy, daily_log for streaks. */
export async function toggleDaily(d: DailyTask, day: string) {
  const isToday = day === localDay()
  const done = isToday ? d.done_on === day : data.daily_log.some((l) => l.daily_id === d.id && l.day === day)
  const nextDoneOn = isToday ? (done ? null : day) : d.done_on === day && done ? null : d.done_on
  if (!supa) {
    const all = demoAll()
    if (nextDoneOn !== d.done_on) all.daily_tasks = all.daily_tasks.map((x) => (x.id === d.id ? { ...x, done_on: nextDoneOn } : x))
    all.daily_log = done ? all.daily_log.filter((l) => !(l.daily_id === d.id && l.day === day)) : [...all.daily_log, { daily_id: d.id, day }]
    demoSave(all)
  } else {
    const [a, b] = await Promise.all([
      nextDoneOn !== d.done_on ? supa.from('daily_tasks').update({ done_on: nextDoneOn }).eq('id', d.id) : Promise.resolve({ error: null }),
      done
        ? supa.from('daily_log').delete().eq('daily_id', d.id).eq('day', day)
        : supa.from('daily_log').upsert({ daily_id: d.id, day }, { onConflict: 'daily_id,day', ignoreDuplicates: true }),
    ])
    const error = a.error ?? b.error
    if (error) throw new Error(error.message.includes('daily_log') ? 'Falta la tabla daily_log: ejecuta supabase/setup.sql' : error.message)
  }
  await refresh(nextDoneOn !== d.done_on ? ['daily_tasks', 'daily_log'] : ['daily_log'])
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

export interface UndoTask { id: string; title: string; status: Task['status']; done_at: string | null; closedAs: Task['status'] }
let lastClosed: UndoTask | null = null
let undoTimer = 0
const clearUndo = () => { clearTimeout(undoTimer); if (lastClosed) { lastClosed = null; emit() } }
export const useUndo = () => useSyncExternalStore(subscribe, () => lastClosed)

export async function undoTask() {
  if (!lastClosed) return
  const { id, status, done_at } = lastClosed
  clearUndo()
  await update('tasks', id, { status, done_at })
}

/** Finishing or discarding stamps done_at (the 7 days in «Terminadas» count from it); reopening clears it. */
export const setTaskStatus = (t: Task, status: Task['status']) => {
  if (CLOSED.includes(status)) {
    clearTimeout(undoTimer)
    lastClosed = { id: t.id, title: t.title, status: t.status, done_at: t.done_at, closedAs: status }
    undoTimer = window.setTimeout(clearUndo, 4500)
  } else if (lastClosed?.id === t.id) {
    clearUndo()
  }
  return update('tasks', t.id, { status, done_at: CLOSED.includes(status) ? new Date().toISOString() : null })
}

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

// Email + password. `captchaToken` comes from Turnstile (src/Captcha.tsx) once it's switched on.
export async function signIn(email: string, password: string, captchaToken?: string) {
  const { error } = await supa!.auth.signInWithPassword({ email, password, options: { captchaToken } })
  if (error) throw new Error(error.message.includes('Invalid login') ? 'Email o contraseña incorrectos' : error.message)
}

export async function signUp(email: string, password: string, captchaToken?: string) {
  const { data, error } = await supa!.auth.signUp({ email, password, options: { captchaToken } })
  if (error) throw new Error(error.message.includes('already registered') ? 'Ese email ya tiene cuenta: pulsa Entrar' : error.message)
  if (!data.session) throw new Error('Cuenta creada: te hemos enviado un email para confirmarla. Ábrelo y luego entra aquí.')
}

export async function signOut() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const sub = await reg?.pushManager?.getSubscription()
    if (sub) {
      await supa?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch { /* offline or no service worker */ }
  await supa?.auth.signOut()
  clearUndo()
  setTimeZone(null)
  data = { ...EMPTY, closed: [], profile: null, loaded: false }
  emit()
}

/**
 * «¿Olvidaste tu contraseña?»: Supabase emails a link back to the app; opening it signs the user in in
 * «recovery» mode and App shows NewPassword. Needs the app's address in Supabase → Authentication →
 * URL Configuration, and an email sender (SMTP) for anyone who isn't on the Supabase team (README).
 */
export async function resetPassword(email: string, captchaToken?: string) {
  const { error } = await supa!.auth.resetPasswordForEmail(email, { redirectTo: location.origin, captchaToken })
  if (error) throw new Error(error.message.includes('rate limit') ? 'Demasiados intentos: espera un rato y vuelve a probar.' : error.message)
}

export async function updatePassword(password: string) {
  const { error } = await supa!.auth.updateUser({ password })
  if (error) throw new Error(error.message.includes('different from the old') ? 'Tiene que ser distinta de la anterior.' : error.message)
}

/** Deletes the account and all its data (api/account.ts), then signs out on this device. */
export async function deleteAccount() {
  const r = await fetch('/api/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await accessToken()}` },
    body: JSON.stringify({ action: 'delete' }),
  })
  if (!r.ok) throw new Error('No se pudo borrar la cuenta. Inténtalo más tarde.')
  await signOut()
}

/** Proves to our own server (api/capture.ts) who is signed in. */
export async function accessToken() {
  return (await currentSession())?.access_token
}
