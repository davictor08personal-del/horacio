import { describe, expect, it } from 'vitest'
import { cleanCapture, mockCapture } from './capture'
import { addDays, allTags, byPriority, cleanTag, dayPlan, doneToday, googleCalendarUrl, localMinutes, parseSearch, projectsTagged, taskMatchesTags, weeklyStreak, dueReminders, morningSummary, fromChecklist, greeting, localDay, nextFpBlock, noteMatches, notePreview, noteTime, relDay, shiftHours, splitToday, toChecklist, weekOf } from './logic'
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
    expect(localDay(new Date('2026-11-02T23:30:00Z'))).toBe('2026-11-03') // 00:30 in Madrid
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
  it('says the day in one sentence', () => {
    expect(dayPlan(shift({ kind: 'noche', starts_at: '17:00', ends_at: '23:00' })).line).toBe('Turno de noche a las 17:00. Libre hasta las 16:30.')
    expect(dayPlan(shift({ kind: 'opening', starts_at: '10:00', ends_at: '17:30' })).line).toBe('Turno de opening hasta las 17:30. Libre después.')
    expect(dayPlan(undefined).line).toBe('Hoy no trabajas: tienes el día libre.')
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
    expect(r.tasks).toEqual([{ title: 'Pagar luz', priority: 'media', effort: 'medio', status: 'abierto', due_date: null, due_time: '18:30', area: null, details: null, project: null, ask_project: false }])
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
    const d = { id: '1', title: 'Gimnasio', position: 0, done_on: '2026-11-03', created_at: '', project_id: null, description: null, icon: null, note_id: null, color: 'none' }
    expect(doneToday(d, '2026-11-03')).toBe(true)
    expect(doneToday(d, '2026-11-04')).toBe(false)
  })
})

describe('capture kinds', () => {
  it('keeps notes, checklists and daily tasks, and only true asks', () => {
    const r = cleanCapture({
      notes: [{ title: 'Compra', body: '', items: ['leche', ' ', 'pan'], ask_project: 'yes' }, { title: '', body: '' }],
      daily_tasks: [{ title: 'Leer 10 minutos', project: 'FP', ask_project: 'yes' }, { title: '' }],
      tasks: [{ title: 'Pedir presupuestos', project: 'Mudanza', ask_project: true }],
    })
    expect(r.notes).toEqual([{ title: 'Compra', body: '', items: ['leche', 'pan'], project: null, ask_project: false }])
    expect(r.daily_tasks).toEqual([{ title: 'Leer 10 minutos', project: 'FP', ask_project: false }])
    expect(r.tasks[0]).toMatchObject({ project: 'Mudanza', ask_project: true, details: null })
  })
  it('the canned AI tells the kinds apart and finds the project', () => {
    const today = '2026-11-02'
    expect(mockCapture({ text: 'lista de la compra: leche, pan' }, today).notes[0]).toMatchObject({ title: 'La compra', items: ['leche', 'pan'] })
    expect(mockCapture({ text: 'meditar todos los días' }, today).daily_tasks).toEqual([{ title: 'Meditar', project: null, ask_project: false }])
    expect(mockCapture({ text: 'recuérdame llamar a mamá a las 20' }, today).tasks[0]).toMatchObject({ title: 'Llamar a mamá', due_date: today, due_time: '20:00' })
    expect(mockCapture({ text: 'comprar cajas para la mudanza', projects: ['Mudanza'] }, today).tasks[0]).toMatchObject({ project: 'Mudanza', ask_project: false })
    expect(mockCapture({ text: 'idea para el proyecto: modo claro' }, today).notes[0]).toMatchObject({ ask_project: true })
  })
})

describe('notifications', () => {
  // 2026-11-05 10:00 in Madrid (UTC+1 in November)
  const now = new Date('2026-11-05T09:00:00Z')
  it('a reminder rings once its Madrid day and time arrive', () => {
    const due = [
      task({ title: 'now', due_date: '2026-11-05', due_time: '10:00:00' }),
      task({ title: 'earlier today', due_date: '2026-11-05', due_time: '08:15' }),
      task({ title: 'late last night', due_date: '2026-11-04', due_time: '23:50' }),
    ]
    const notYet = [
      task({ title: 'later', due_date: '2026-11-05', due_time: '10:01' }),
      task({ title: 'no time', due_date: '2026-11-05' }),
      task({ title: 'too old', due_date: '2026-11-03', due_time: '09:00' }),
      task({ title: 'done', due_date: '2026-11-05', due_time: '09:00', status: 'hecho' }),
      task({ title: 'waiting', due_date: '2026-11-05', due_time: '09:00', status: 'esperando' }),
    ]
    expect(dueReminders([...due, ...notYet], now).map((t) => t.title)).toEqual(due.map((t) => t.title))
  })
  it('the morning summary says the day and the first three', () => {
    const tasks = ['a', 'b', 'c', 'd'].map((title, i) => task({ title, created_at: `2026-11-0${i + 1}T10:00:00Z` }))
    const s = morningSummary(tasks, shift({ kind: 'noche', starts_at: '17:00', ends_at: '23:00' }), 'Victor')
    expect(s.title).toBe('Buenos días, Victor')
    expect(s.body).toBe('Turno de noche a las 17:00. Libre hasta las 16:30. Prioridades: 1. a · 2. b · 3. c (y 1 más que pueden esperar)')
    expect(morningSummary([], undefined, 'Victor').body).toBe('Hoy no trabajas: tienes el día libre. Nada urgente para hoy.')
  })
})

describe('weekly streaks', () => {
  // Thursday 2026-11-05; weeks start on Monday 11-02, 10-26, 10-19…
  const today = '2026-11-05'
  it('counts weeks in a row with at least one day', () => {
    expect(weeklyStreak(['2026-11-03', '2026-10-30', '2026-10-19', '2026-10-20'], today)).toBe(3)
  })
  it('a week with nothing breaks it', () => {
    expect(weeklyStreak(['2026-11-03', '2026-10-19'], today)).toBe(1)
  })
  it('this week not done yet keeps last weeks alive', () => {
    expect(weeklyStreak(['2026-10-28', '2026-10-21'], today)).toBe(2)
  })
  it('nothing, nothing', () => {
    expect(weeklyStreak([], today)).toBe(0)
    expect(weeklyStreak(['2026-10-12'], today)).toBe(0)
  })
})

describe('Google Calendar link', () => {
  const params = (url: string | null) => Object.fromEntries(new URL(url!).searchParams)
  it('a reminder with a time is a 30-minute event in Madrid time', () => {
    expect(params(googleCalendarUrl({ title: 'Llamar al casero', notes: null, due_date: '2026-11-07', due_time: '12:00:00' })))
      .toMatchObject({ action: 'TEMPLATE', text: 'Llamar al casero', dates: '20261107T120000/20261107T123000', ctz: 'Europe/Madrid' })
  })
  it('only a day: all day; late at night it ends the next day', () => {
    expect(params(googleCalendarUrl({ title: 'x', notes: null, due_date: '2026-11-07', due_time: null })).dates).toBe('20261107/20261108')
    expect(params(googleCalendarUrl({ title: 'x', notes: null, due_date: '2026-11-07', due_time: '23:45' })).dates).toBe('20261107T234500/20261108T001500')
  })
  it('no day, no link', () => {
    expect(googleCalendarUrl({ title: 'x', notes: null, due_date: null, due_time: null })).toBeNull()
  })
})

describe('time zones', () => {
  const t = new Date('2026-11-06T01:30:00Z') // 02:30 in Madrid, 21:30 the day before in Caracas
  it('«today» is the user\'s, not Madrid\'s', () => {
    expect(localDay(t, 'Europe/Madrid')).toBe('2026-11-06')
    expect(localDay(t, 'America/Caracas')).toBe('2026-11-05')
    expect(localMinutes(t, 'America/Caracas')).toBe(21 * 60 + 30)
  })
  it('reminders ring at the user\'s time', () => {
    const r = task({ title: 'r', due_date: '2026-11-05', due_time: '21:00' })
    expect(dueReminders([r], t, 'America/Caracas')).toHaveLength(1)
    expect(dueReminders([task({ title: 'r', due_date: '2026-11-05', due_time: '22:00' })], t, 'America/Caracas')).toHaveLength(0)
  })
  it('the summary without the shifts module only lists priorities', () => {
    expect(morningSummary([], undefined, null, false)).toEqual({ title: 'Buenos días', body: 'Nada urgente para hoy.' })
  })
})

describe('tags', () => {
  it('are stored clean', () => {
    expect(cleanTag('#Aprendizaje de Idiomas')).toBe('aprendizaje-de-idiomas')
    expect(cleanTag('  ##Salud!! ')).toBe('salud')
    expect(cleanTag('#')).toBe('')
  })
  it('#words in a search are tags, the rest is text', () => {
    expect(parseSearch('#Idiomas verbos #fr')).toEqual({ tags: ['idiomas', 'fr'], text: 'verbos' })
  })
  it('a tag finds every project that has it, also by its start', () => {
    const ps = [{ id: 'en', tags: ['idiomas'] }, { id: 'fr', tags: ['idiomas', 'viajes'] }, { id: 'gym', tags: ['salud'] }]
    expect([...projectsTagged(ps, ['idio'])]).toEqual(['en', 'fr'])
    expect([...projectsTagged(ps, ['idiomas', 'viajes'])]).toEqual(['fr'])
  })
  it('taskMatchesTags checks task tags or project tags', () => {
    const tagged = new Set(['proj1'])
    expect(taskMatchesTags({ tags: ['urgente'], project_id: null }, ['urg'])).toBe(true)
    expect(taskMatchesTags({ tags: [], project_id: 'proj1' }, ['idiomas'], tagged)).toBe(true)
    expect(taskMatchesTags({ tags: ['hogar'], project_id: 'other' }, ['urg'], tagged)).toBe(false)
  })
  it('allTags combines tags from multiple sources', () => {
    expect(allTags([{ tags: ['b', 'a'] }], [{ tags: ['c', 'a'] }])).toEqual(['a', 'b', 'c'])
  })
})
