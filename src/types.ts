// Same shapes as the tables in supabase/setup.sql. Dates are 'YYYY-MM-DD', times 'HH:MM' (or 'HH:MM:SS' from Postgres).

export type Status = 'abierto' | 'en_curso' | 'esperando' | 'hecho' | 'descartado'
export type Priority = 'alta' | 'media' | 'baja'
export type Effort = 'rapido' | 'medio' | 'grande'
export type ShiftKind = 'opening' | 'dia' | 'noche' | 'libre'
export type ProjectStatus = 'activo' | 'pausado' | 'hecho'

export interface Task {
  id: string
  title: string
  notes: string | null
  status: Status
  priority: Priority
  effort: Effort
  due_date: string | null
  due_time: string | null
  area: string | null
  project_id: string | null
  note_id: string | null
  created_at: string
  done_at: string | null
  notified_at?: string | null
  /** Postponed: out of «Prioridades de hoy» until this day (YYYY-MM-DD). Not a deadline; due_date is. */
  snoozed_until?: string | null
  color?: string
  tags?: string[]
}

export type NoteColor = 'none' | 'rojo' | 'naranja' | 'amarillo' | 'verde' | 'azul' | 'morado'
export interface ChecklistItem { text: string; done: boolean }

/** A note. With `items` it's a checklist (as in Google Keep); without, `body` is plain text. */
export interface Note {
  id: string
  title: string
  body: string
  items: ChecklistItem[] | null
  color: NoteColor
  project_id: string | null
  pinned: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

/** Something to do every day (gym, Busuu…). `done_on` is the day it was last ticked. */
export interface DailyTask {
  id: string
  title: string
  position: number
  done_on: string | null
  project_id: string | null
  description: string | null
  /** An emoji, or a small picture as a data: URL (like a project's). */
  icon: string | null
  note_id: string | null
  /** Tile colour on Hoy (key of DAILY_COLORS); 'none' = the normal card. */
  color: string
  created_at: string
}

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  description: string | null
  icon: string | null
  /** Clean tags without # (cleanTag): «aprendizaje-de-idiomas». */
  tags: string[]
  next_step: string | null
  area: string | null
  created_at: string
  color?: string
}

export interface Shift {
  id: string
  day: string
  kind: ShiftKind
  starts_at: string | null
  ends_at: string | null
}

export interface FpTest {
  id: string
  subject: string
  block: number | null
  unit: string
  opens_on: string | null
  closes_on: string | null
  read: boolean
}

export const STATUS: Record<Status, string> = {
  abierto: 'Abierta', en_curso: 'En curso', esperando: 'Esperando', hecho: 'Hecha', descartado: 'Descartada',
}
export const PRIORITY: Record<Priority, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
export const EFFORT: Record<Effort, string> = { rapido: 'Rápido', medio: 'Medio', grande: 'Grande' }
export const SHIFT: Record<ShiftKind, string> = { opening: 'Opening', dia: 'Día', noche: 'Noche', libre: 'Libre' }
export const PROJECT_STATUS: Record<ProjectStatus, string> = { activo: 'Activo', pausado: 'Pausado', hecho: 'Hecho' }
export const NOTE_COLOR: Record<NoteColor, string> = {
  none: 'Sin color', rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo', verde: 'Verde', azul: 'Azul', morado: 'Morado',
}
export const NOTE_COLORS = Object.keys(NOTE_COLOR) as NoteColor[]

/** One day a daily task was done (table daily_log): the streaks are counted from these. */
export interface DailyLog { daily_id: string; day: string }

/** The user's profile (table profiles): name, time zone and optional modules. */
export interface Profile { user_id: string; name: string | null; timezone: string; shifts: boolean; fp: boolean }

/** Colours a daily task can have on Hoy: a solid tile with white text (CSS .dc-<name>). */
export const DAILY_COLORS: Record<string, string> = {
  // «vinotinto» is shown as Ciruela now; the key stays so colours already saved keep working.
  none: 'Sin color', morado: 'Lila', azul: 'Azul', verde: 'Menta', amarillo: 'Amarillo', naranja: 'Melocotón', rojo: 'Coral', rosa: 'Rosa', vinotinto: 'Ciruela', gris: 'Niebla',
}
