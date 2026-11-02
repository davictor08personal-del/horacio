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
  created_at: string
  done_at: string | null
}

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  next_step: string | null
  area: string | null
  created_at: string
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
