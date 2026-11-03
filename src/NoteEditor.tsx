import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type TextareaHTMLAttributes } from 'react'
import { addDays, fromChecklist, madridDay, toChecklist } from './logic'
import { createTask, remove, update, useData } from './store'
import Sheet from './Sheet'
import { TaskRow } from './TaskRow'
import { NOTE_COLOR, NOTE_COLORS, type ChecklistItem, type Note } from './types'

// SVG path data (24×24, strokes), drawn like the tab icons.
export const ICON = {
  back: 'M15 5l-7 7 7 7',
  pin: 'M9 4h6l-1 6 4 4H6l4-4zM12 14v7',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
  checklist: 'M4 7l2 2 3-3M4 15l2 2 3-3M12 8h8M12 16h8',
  color: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.4-.8-2.3 0-.9.7-1.7 1.7-1.7H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  compose: 'M12 4H5v15h15v-7M18 3l3 3-9 9H9v-3z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 6h16M4 12h16M4 18h16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  note: 'M6 3h9l4 4v14H6zM9 9h6M9 13h6M9 17h4',
  x: 'M6 6l12 12M18 6L6 18',
}
export const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden><path d={d} /></svg>

// Which note is open, from anywhere (the Notas list, or a reminder's sheet). App draws the editor on top.
let openId: string | null = null
const subs = new Set<() => void>()
export const openNote = (id: string | null) => ((openId = id), subs.forEach((l) => l()))
export const useOpenNote = () => useSyncExternalStore((l) => (subs.add(l), () => subs.delete(l)), () => openId)

const fullDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

interface Draft { title: string; body: string; items: ChecklistItem[] | null }
const isEmpty = (d: Draft) => !d.title.trim() && !d.body.trim() && !(d.items ?? []).some((i) => i.text.trim())

/**
 * A note, full screen like iOS Notes. The text is saved while you type (a moment after you stop) and when you go back.
 * Pin, colour, checklist, archive and share come from Google Keep; the bell turns the note into a reminder.
 */
export default function NoteEditor({ id }: { id: string }) {
  const { notes, tasks, projects } = useData()
  const note = notes.find((n) => n.id === id)
  const [draft, setDraft] = useState<Draft>(() => ({ title: note?.title ?? '', body: note?.body ?? '', items: note?.items ?? null }))
  const [palette, setPalette] = useState(false)
  const [reminding, setReminding] = useState(false)
  const dirty = useRef(false)
  const reminders = tasks.filter((t) => t.note_id === id)

  const save = () => {
    if (!dirty.current) return
    dirty.current = false
    return update('notes', id, { ...draft, updated_at: new Date().toISOString() })
  }
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(save, 700)
    return () => clearTimeout(t)
  })

  if (!note) return null
  const edit = (patch: Partial<Draft>) => ((dirty.current = true), setDraft((d) => ({ ...d, ...patch })))
  const set = (patch: Partial<Note>) => update('notes', id, patch)

  async function close() {
    openNote(null)
    // An empty note with nothing linked is discarded, as in Keep and iOS.
    if (isEmpty(draft) && !reminders.length) return remove('notes', id)
    await save()
  }

  const toggleChecklist = () => edit(draft.items ? { items: null, body: fromChecklist(draft.items) } : { items: toChecklist(draft.body), body: '' })

  async function share() {
    const text = [draft.title, draft.items ? draft.items.map((i) => `${i.done ? '☑' : '☐'} ${i.text}`).join('\n') : draft.body].filter(Boolean).join('\n\n')
    if (navigator.share) await navigator.share({ title: draft.title, text }).catch(() => {})
    else await navigator.clipboard.writeText(text).then(() => alert('Copiada al portapapeles'))
  }

  return (
    <div className={`note-editor c-${note.color}`} role="dialog" aria-label="Nota">
      <header className="note-bar">
        <button className="back" onClick={close}><Icon d={ICON.back} />Notas</button>
        <div className="note-bar-actions">
          <button className={`icon-btn ${note.pinned ? 'on' : ''}`} onClick={() => set({ pinned: !note.pinned })} aria-label={note.pinned ? 'No fijar' : 'Fijar'} aria-pressed={note.pinned}><Icon d={ICON.pin} /></button>
          <button className="icon-btn" onClick={share} aria-label="Compartir"><Icon d={ICON.share} /></button>
        </div>
      </header>

      <div className="note-scroll">
        <p className="note-date">{fullDate(note.updated_at)}{note.archived && ' · Archivada'}</p>
        <select className="note-project" value={note.project_id ?? ''} onChange={(e) => set({ project_id: e.target.value || null })} aria-label="Proyecto">
          <option value="">Sin proyecto</option>
          {projects.filter((p) => p.status !== 'hecho' || p.id === note.project_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Grow className="note-title" rows={1} value={draft.title} placeholder="Título" onChange={(e) => edit({ title: e.target.value.replace(/\n/g, ' ') })} aria-label="Título" />
        {draft.items ? (
          <Checklist items={draft.items} onChange={(items) => edit({ items })} />
        ) : (
          <Grow className="note-body" value={draft.body} placeholder="Nota" onChange={(e) => edit({ body: e.target.value })} aria-label="Texto" autoFocus={isEmpty(draft)} />
        )}

        {reminders.length > 0 && (
          <section className="group note-reminders">
            <h2 className="group-title">Recordatorios</h2>
            <ul className="list card-list">{reminders.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          </section>
        )}
      </div>

      {palette && (
        <div className="palette" role="radiogroup" aria-label="Color">
          {NOTE_COLORS.map((c) => (
            <button key={c} className={`swatch c-${c} ${c === note.color ? 'on' : ''}`} onClick={() => set({ color: c })} role="radio" aria-checked={c === note.color} aria-label={NOTE_COLOR[c]} />
          ))}
        </div>
      )}
      <footer className="note-tools">
        <button className={`icon-btn ${draft.items ? 'on' : ''}`} onClick={toggleChecklist} aria-label={draft.items ? 'Quitar casillas' : 'Mostrar casillas'}><Icon d={ICON.checklist} /></button>
        <button className={`icon-btn ${palette ? 'on' : ''}`} onClick={() => setPalette(!palette)} aria-label="Color"><Icon d={ICON.color} /></button>
        <button className="icon-btn" onClick={() => setReminding(true)} aria-label="Añadir recordatorio"><Icon d={ICON.bell} /></button>
        <button className="icon-btn" onClick={() => (openNote(null), update('notes', id, { ...draft, archived: !note.archived, pinned: false, updated_at: new Date().toISOString() }))} aria-label={note.archived ? 'Desarchivar' : 'Archivar'}><Icon d={ICON.archive} /></button>
        <button className="icon-btn danger" onClick={() => confirm(reminders.length ? '¿Borrar esta nota? Sus recordatorios se quedan.' : '¿Borrar esta nota?') && (openNote(null), remove('notes', id))} aria-label="Borrar"><Icon d={ICON.trash} /></button>
      </footer>

      {reminding && <ReminderSheet note={{ ...note, ...draft }} onClose={() => setReminding(false)} />}
    </div>
  )
}

/** Keep-style list: Enter adds the next item, Backspace on an empty one removes it, ticked items sink to the bottom. */
function Checklist({ items, onChange }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [focus, setFocus] = useState<number | null>(null)
  useEffect(() => {
    if (focus === null) return
    refs.current[focus]?.focus()
    setFocus(null)
  }, [focus])

  const order = items.map((item, i) => ({ item, i })).sort((a, b) => Number(a.item.done) - Number(b.item.done))
  const put = (i: number, patch: Partial<ChecklistItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const insertAfter = (i: number) => (onChange([...items.slice(0, i + 1), { text: '', done: false }, ...items.slice(i + 1)]), setFocus(i + 1))
  const drop = (i: number) => (onChange(items.filter((_, j) => j !== i)), setFocus(Math.max(0, i - 1)))
  const firstDone = order.findIndex((o) => o.item.done)
  const doneCount = items.length - firstDone

  return (
    <ul className="checklist">
      {order.map(({ item, i }, k) => (
        <li key={i} className={item.done ? 'done' : ''}>
          {k === firstDone && k > 0 && <span className="checklist-sep">{doneCount} {doneCount === 1 ? 'marcado' : 'marcados'}</span>}
          <button className={`tick small ${item.done ? 'done' : ''}`} onClick={() => put(i, { done: !item.done })} aria-label={item.done ? 'Desmarcar' : 'Marcar'} />
          <input
            ref={(el) => { refs.current[i] = el }}
            value={item.text}
            onChange={(e) => put(i, { text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); insertAfter(i) }
              if (e.key === 'Backspace' && !item.text && items.length > 1) { e.preventDefault(); drop(i) }
            }}
            aria-label="Elemento"
          />
        </li>
      ))}
      <li><button className="link add-item" onClick={() => insertAfter(items.length - 1)}>＋ Elemento</button></li>
    </ul>
  )
}

/** Note → reminder: a task with a date (and time) that stays linked to this note. */
function ReminderSheet({ note, onClose }: { note: Note; onClose: () => void }) {
  const today = madridDay()
  const [title, setTitle] = useState(note.title.trim() || fromChecklist(note.items ?? []).split('\n')[0] || note.body.split('\n')[0].trim())
  const [day, setDay] = useState(today)
  const [time, setTime] = useState('')
  const QUICK: [string, string][] = [['Hoy', today], ['Mañana', addDays(today, 1)], ['En una semana', addDays(today, 7)]]

  const save = () => createTask({ title: title.trim() || 'Recordatorio', due_date: day || null, due_time: time || null, note_id: note.id, project_id: note.project_id }).then(onClose)

  return (
    <Sheet title="Recordatorio" onClose={onClose}>
      <input className="big-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué te recuerdo?" aria-label="Título" />
      <div className="choice">
        {QUICK.map(([label, d]) => <button type="button" key={label} className={day === d ? 'on' : ''} onClick={() => setDay(d)}>{label}</button>)}
      </div>
      <div className="two-col">
        <label className="field">Día
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="field">Hora
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <p className="hint">Aparecerá en Tareas y en Hoy, enlazado a esta nota.</p>
      <button className="primary" onClick={save}>Guardar</button>
    </Sheet>
  )
}

/** A textarea as tall as its text, so the whole note scrolls as one page (CSS field-sizing isn't in every Safari yet). */
function Grow(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [props.value])
  return <textarea ref={ref} {...props} />
}
