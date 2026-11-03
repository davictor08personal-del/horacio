import { describe, expect, it } from 'vitest'
import { cleanCapture, mockCapture } from './capture'
import { addDays, byPriority, dayPlan, doneToday, fromChecklist, greeting, madridDay, nextFpBlock, noteMatches, notePreview, noteTime, relDay, shiftHours, splitToday, toChecklist, weekOf } from './logic'
import type { FpTest, Note, Shift, Task } from './types'

const task = (p: Partial<Task>): Task => ({
  id: Math.random().toString(), title: 't', notes: null, status: 'abierto', priority: 'media', effort: 'medio',
  due_date: null, due_time: null, area: null, project_id: null, note_id: null, created_at: '2026-11-01T10:00:00Z', done_at: null, ...p,
})
const shift = (p: Partial<Shift>): Shift => ({ id: '1', day: '2026-11-02', kind: 'libre', starts_at: null, ends_at: null, ...p })

describe('dates', () => {
  it('weeks run Monday to Sunday', () => {
    expect(weekOf('2026-11-04')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
  })
  it('relative days', () => {
    expect(relDay('2026-11-02', '2026-11-02')).toBe('Hoy')
    expect(relDay('2026-11-03', '2026-11-02')).toBe('Mañana')
    expect(relDay('2026-10-30', '2026-11-02')).toBe('Hace 3 días')
    expect(relDay('2026-11-06', '2026-11-02')).toBe('viernes')
    expect(relDay('2026-11-20', '2026-11-02')).toBe('20 nov')
  })
  it('Madrid day crosses midnight in Madrid, not in UTC', () => {
    expect(madridDay(new Date('2026-11-02T23:30:00Z'))).toBe('2026-11-03') // 00:30 in Madrid
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26') // daylight saving change
  })
})

describe('shifts', () => {
  it('night ends at 24:00 on Saturday', () => {
    expect(shiftHours('noche', '2026-11-07').ends_at).toBe('24:00')
    expect(shiftHours('noche', '2026-11-06').ends_at).toBe('23:00')
  })
  it('free time before a night shift, after an opening', () => {
    expect(dayPlan(shift({ kind: 'noche', starts_at: '17:00', ends_at: '23:00' })).free).toBe('Libre hasta las 16:30')
    expect(dayPlan(shift({ kind: 'opening', starts_at: '10:00:00', ends_at: '17:30:00' })).free).toBe('Libre desde las 17:30')
    expect(dayPlan(undefined)).toMatchObject({ work: false, free: 'Todo el día libre' })
  })
})

describe('priorities', () => {
  it('deadline, then priority, then quick effort', () => {
    const a = task({ title: 'sin fecha alta', priority: 'alta' })
    const b = task({ title: 'viernes', due_date: '2026-11-06' })
    const c = task({ title: 'mañana baja', due_date: '2026-11-03', priority: 'baja' })
    const d = task({ title: 'mañana alta grande', due_date: '2026-11-03', priority: 'alta', effort: 'grande' })
    const e = task({ title: 'mañana alta rápida', due_date: '2026-11-03', priority: 'alta', effort: 'rapido' })
    expect([a, b, c, d, e].sort(byPriority).map((t) => t.title)).toEqual(['mañana alta rápida', 'mañana alta grande', 'mañana baja', 'viernes', 'sin fecha alta'])
  })
  it('focus is 3 at most; waiting tasks never in focus', () => {
    const { focus, later, waiting } = splitToday([task({}), task({}), task({ status: 'esperando' }), task({ status: 'en_curso' }), task({})])
    expect(focus).toHaveLength(3)
    expect(later).toHaveLength(1)
    expect(waiting).toHaveLength(1)
  })
})

describe('FP', () => {
  const t = (p: Partial<FpTest>): FpTest => ({ id: '1', subject: 'Nóminas', block: 2, unit: 'U1', opens_on: null, closes_on: null, read: false, ...p })
  it('nearest future block and its unread units', () => {
    const r = nextFpBlock([t({ opens_on: '2026-10-01', read: false }), t({ opens_on: '2026-11-10' }), t({ opens_on: '2026-11-10', read: true }), t({ opens_on: '2026-12-01' })], '2026-11-02')
    expect(r).toMatchObject({ opensOn: '2026-11-10', days: 8, unread: 1, units: 2 })
    expect(nextFpBlock([], '2026-11-02')).toBeNull()
  })
})

describe('capture', () => {
  it('cleans the AI answer: bad fields out, defaults in', () => {
    const r = cleanCapture({
      tasks: [{ title: ' Pagar luz ', priority: 'urgentísima', due_date: 'mañana', due_time: '18:30' }, { title: '' }],
      shifts: [{ day: '2026-11-07', kind: 'noche' }, { day: 'sábado', kind: 'dia' }],
      fp_tests: [{ subject: 'Nóminas', unit: 'U3', block: 2.5 }],
    })
    expect(r.tasks).toEqual([{ title: 'Pagar luz', priority: 'media', effort: 'medio', status: 'abierto', due_date: null, due_time: '18:30', area: null, project: null }])
    expect(r.shifts).toEqual([{ day: '2026-11-07', kind: 'noche', starts_at: '17:00', ends_at: '24:00' }])
    expect(r.fp_tests[0].block).toBeNull()
    expect(r.projects).toEqual([])
  })
  it('mock understands "mañana" and "urgente"', () => {
    const r = mockCapture({ text: 'mañana sacar el alquiler, urgente' }, '2026-11-02')
    expect(r.tasks[0]).toMatchObject({ title: 'Sacar el alquiler', priority: 'alta', due_date: '2026-11-03' })
  })
})

const note = (p: Partial<Note>): Note => ({
  id: '1', title: '', body: '', items: null, color: 'none', project_id: null, pinned: false, archived: false,
  created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z', ...p,
})

describe('notes', () => {
  it('text becomes a checklist and back, skipping empty lines', () => {
    const items = toChecklist('leche\n\n  pan \nhuevos')
    expect(items).toEqual([{ text: 'leche', done: false }, { text: 'pan', done: false }, { text: 'huevos', done: false }])
    expect(fromChecklist(items)).toBe('leche\npan\nhuevos')
  })
  it('search ignores accents and case, and looks inside checklists', () => {
    expect(noteMatches(note({ title: 'Canción para el viernes' }), 'cancion')).toBe(true)
    expect(noteMatches(note({ items: [{ text: 'Comprar PAN', done: false }] }), 'pan')).toBe(true)
    expect(noteMatches(note({ body: 'nada' }), 'pan')).toBe(false)
    expect(noteMatches(note({}), '  ')).toBe(true)
  })
  it('preview is the first line with text', () => {
    expect(notePreview(note({ body: '\n  \nhola\nadiós' }))).toBe('hola')
    expect(notePreview(note({ items: [{ text: 'pan', done: true }] }))).toBe('pan')
  })
  it('time reads like iOS Notes', () => {
    const now = new Date('2026-11-04T12:00:00Z')
    expect(noteTime('2026-11-04T09:42:00Z', now)).toBe('10:42') // Madrid is UTC+1 in November
    expect(noteTime('2026-11-03T09:00:00Z', now)).toBe('Ayer')
    expect(noteTime('2026-11-02T09:00:00Z', now)).toBe('lunes')
    expect(noteTime('2026-10-20T09:00:00Z', now)).toBe('20 oct')
  })
})

describe('Hoy', () => {
  it('greets by the hour', () => {
    expect(greeting(8 * 60)).toBe('Buenos días')
    expect(greeting(13 * 60)).toBe('Buenas tardes')
    expect(greeting(22 * 60 + 30)).toBe('Buenas noches')
    expect(greeting(2 * 60)).toBe('Buenas noches')
  })
  it('a daily task is ticked only on the day it was ticked', () => {
    const d = { id: '1', title: 'Gimnasio', position: 0, done_on: '2026-11-03', created_at: '' }
    expect(doneToday(d, '2026-11-03')).toBe(true)
    expect(doneToday(d, '2026-11-04')).toBe(false)
  })
})
