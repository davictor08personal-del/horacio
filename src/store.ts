// Where the data lives. With VITE_SUPABASE_URL/KEY: Supabase (the source of truth, see supabase/setup.sql).
// Without them: "demo mode", saved in this browser's localStorage, to try the app before creating the project.
import { useSyncExternalStore } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { addDays, madridDay } from './logic'
import type { FpTest, Project, Shift, Task } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined
export const demo = !(url && key)
// The publishable key is meant to be public: Row Level Security decides what each user can see.
export const supa = demo ? null : createClient(url!, key!)

type Table = 'tasks' | 'projects' | 'shifts' | 'fp_tests'
type RowOf = { tasks: Task; projects: Project; shifts: Shift; fp_tests: FpTest }
export interface Data { tasks: Task[]; projects: Project[]; shifts: Shift[]; fp_tests: FpTest[]; loaded: boolean }

let data: Data = { tasks: [], projects: [], shifts: [], fp_tests: [], loaded: false }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

/** The whole app reads from here; any change re-renders the screens that use it. */
export const useData = () => useSyncExternalStore(subscribe, () => data)

// ---------- demo backend (localStorage) ----------
const DEMO_KEY = 'horacio-demo'
const demoAll = (): Omit<Data, 'loaded'> => {
  try {
    return { tasks: [], projects: [], shifts: [], fp_tests: [], ...JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}') }
  } catch {
    return { tasks: [], projects: [], shifts: [], fp_tests: [] }
  }
}
const demoSave = (d: Omit<Data, 'loaded'>) => localStorage.setItem(DEMO_KEY, JSON.stringify(d))

// Only what the screens need: unfinished tasks and shifts from last week on. Small enough to load all at once.
const OPEN = ['abierto', 'en_curso', 'esperando']

export async function load() {
  const since = addDays(madridDay(), -7)
  if (!supa) {
    const d = demoAll()
    data = { ...d, tasks: d.tasks.filter((t) => OPEN.includes(t.status)), shifts: d.shifts.filter((s) => s.day >= since), loaded: true }
    return emit()
  }
  const [tasks, projects, shifts, tests] = await Promise.all([
    supa.from('tasks').select('*').in('status', OPEN),
    supa.from('projects').select('*').order('created_at'),
    supa.from('shifts').select('*').gte('day', since).order('day'),
    supa.from('fp_tests').select('*').order('opens_on').order('unit'),
  ])
  const error = tasks.error ?? projects.error ?? shifts.error ?? tests.error
  if (error) throw new Error(error.message.includes('does not exist') ? 'Faltan las tablas: ejecuta supabase/setup.sql' : error.message)
  data = { tasks: tasks.data ?? [], projects: projects.data ?? [], shifts: shifts.data ?? [], fp_tests: tests.data ?? [], loaded: true }
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

export const setTaskStatus = (t: Task, status: Task['status']) =>
  update('tasks', t.id, { status, done_at: status === 'hecho' ? new Date().toISOString() : null })

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
