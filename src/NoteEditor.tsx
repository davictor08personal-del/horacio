import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type TextareaHTMLAttributes } from 'react'
import { fromChecklist, imagePaths, joinBlocks, splitBody, stripImages, timeZone, toChecklist, type Block } from './logic'
import { deleteNoteImages, MAX_NOTE_IMAGES, uploadNoteImage, useImageUrl } from './noteImages'
import { remove, update, useData } from './store'
import { TaskRow } from './TaskRow'
import type { ChecklistItem, Note } from './types'

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
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  x: 'M6 6l12 12M18 6L6 18',
}
export const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden><path d={d} /></svg>

// Which note is open, from anywhere (the Notas list, or a reminder's sheet). App draws the editor on top.
let openId: string | null = null
const subs = new Set<() => void>()
export const openNote = (id: string | null) => ((openId = id), subs.forEach((l) => l()))
export const useOpenNote = () => useSyncExternalStore((l) => (subs.add(l), () => subs.delete(l)), () => openId)

const fullDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: timeZone(), day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

interface Draft { title: string; body: string; items: ChecklistItem[] | null }
const isEmpty = (d: Draft) => !d.title.trim() && !d.body.trim() && !(d.items ?? []).some((i) => i.text.trim())

/**
 * A note, full screen like iOS Notes. The text is saved while you type (a moment after you stop) and when you go back.
 * Pin, colour, checklist, archive and share come from Google Keep; the bell turns the note into a reminder.
 */
export default function NoteEditor({ id }: { id: string }) {
  const { notes, tasks, projects, daily_tasks } = useData()
  const daily = daily_tasks.find((d) => d.note_id === id)
  const note = notes.find((n) => n.id === id)
  const [draft, setDraft] = useState<Draft>(() => ({ title: note?.title ?? '', body: note?.body ?? '', items: note?.items ?? null }))
  const dirty = useRef(false)
  const removed = useRef<string[]>([]) // pictures taken out of the text: their files go once the note is saved
  const caret = useRef({ i: -1, pos: 0 }) // where the cursor was last, to drop a picture there
  const fileInput = useRef<HTMLInputElement>(null)
  const bodyRef = useRef(draft.body) // the latest text, for pictures that arrive while the state is still updating
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const reminders = tasks.filter((t) => t.note_id === id)

  const save = () => {
    if (!dirty.current) return
    dirty.current = false
    const gone = removed.current
    removed.current = []
    return update('notes', id, { ...draft, updated_at: new Date().toISOString() }).then(() => deleteNoteImages(gone))
  }
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(save, 700)
    return () => clearTimeout(t)
  })

  if (!note) return null
  const edit = (patch: Partial<Draft>) => ((dirty.current = true), setDraft((d) => ({ ...d, ...patch })))
  const set = (patch: Partial<Note>) => {
    const full = dirty.current ? { ...draft, updated_at: new Date().toISOString(), ...patch } : patch
    dirty.current = false
    return update('notes', id, full)
  }

  async function close() {
    openNote(null)
    // An empty note with nothing linked is discarded, as in Keep and iOS.
    if (isEmpty(draft) && !reminders.length && !daily) return dropNote()
    await save()
  }
  /** Deleting a note also deletes its picture files. */
  async function dropNote() {
    const files = [...imagePaths(note!.body), ...imagePaths(draft.body), ...removed.current]
    await remove('notes', id)
    await deleteNoteImages([...new Set(files)])
  }

  const blocks = splitBody(draft.body)
  bodyRef.current = draft.body
  const imageCount = blocks.filter((b) => b.type === 'img').length
  const setBlocks = (next: Block[]) => edit({ body: joinBlocks(next) })
  const typeIn = (i: number, text: string) => setBlocks(blocks.map((b, j) => (j === i ? { type: 'text', text } : b)))
  const removePicture = (i: number) => {
    const b = blocks[i]
    if (b.type !== 'img') return
    removed.current.push(b.path)
    // The text above and below join into one block again.
    const above = blocks[i - 1] as { text: string }, below = blocks[i + 1] as { text: string }
    setBlocks([...blocks.slice(0, i - 1), { type: 'text', text: [above.text, below.text].filter(Boolean).join('\n') }, ...blocks.slice(i + 2)])
  }
  async function addPictures(files: FileList | null) {
    const list = [...(files ?? [])].slice(0, MAX_NOTE_IMAGES - imageCount)
    if (!list.length) return alert(`Máximo ${MAX_NOTE_IMAGES} imágenes por nota.`)
    setUploading(true)
    try {
      for (const file of list) {
        const path = await uploadNoteImage(file)
        // Dropped where the cursor was (text before it above the picture, text after it below); else at the end.
        const cur = splitBody(bodyRef.current)
        const at = caret.current.i >= 0 && cur[caret.current.i]?.type === 'text' ? caret.current.i : cur.length - 1
        const t = cur[at] as { text: string }
        const pos = at === caret.current.i ? Math.min(caret.current.pos, t.text.length) : t.text.length
        caret.current = { i: at + 2, pos: 0 } // the next picture goes below this one
        const next: Block[] = [...cur.slice(0, at), { type: 'text', text: t.text.slice(0, pos).replace(/\n$/, '') }, { type: 'img', path }, { type: 'text', text: t.text.slice(pos).replace(/^\n/, '') }, ...cur.slice(at + 1)]
        bodyRef.current = joinBlocks(next)
        edit({ body: bodyRef.current })
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo añadir la imagen.')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const toggleChecklist = () => imageCount && !draft.items ? alert('Quita las imágenes antes de pasar la nota a casillas.') : edit(draft.items ? { items: null, body: fromChecklist(draft.items) } : { items: toChecklist(draft.body), body: '' })

  async function share() {
    const text = [draft.title, draft.items ? draft.items.map((i) => `${i.done ? '☑' : '☐'} ${i.text}`).join('\n') : stripImages(draft.body)].filter(Boolean).join('\n\n')
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
        {daily && <p className="daily-note-tag note-of">Nota de la tarea diaria «{daily.title}»</p>}
        <Grow className="note-title" rows={1} value={draft.title} placeholder="Título" onChange={(e) => edit({ title: e.target.value.replace(/\n/g, ' ') })} aria-label="Título" />
        {draft.items ? (
          <Checklist items={draft.items} onChange={(items) => edit({ items })} />
        ) : (
          <div className="note-blocks">
            {blocks.map((b, i) => b.type === 'img' ? (
              <NoteImage key={`${b.path}-${i}`} path={b.path} onOpen={setViewing} onRemove={() => confirm('¿Quitar esta imagen de la nota?') && removePicture(i)} />
            ) : (
              <Grow key={`t${i}`} className="note-body note-seg" value={b.text} placeholder={blocks.length === 1 ? 'Nota' : i === blocks.length - 1 ? 'Escribe aquí…' : ''}
                onChange={(e) => typeIn(i, e.target.value)}
                onSelect={(e) => { caret.current = { i, pos: e.currentTarget.selectionStart } }}
                aria-label="Texto" autoFocus={i === 0 && isEmpty(draft)} />
            ))}
          </div>
        )}

        {reminders.length > 0 && (
          <section className="group note-reminders">
            <h2 className="group-title">Recordatorios</h2>
            <ul className="list card-list">{reminders.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          </section>
        )}
      </div>

      <nav className="dock note-dock" aria-label="Acciones de la nota">
        <div className="tabs note-tools">
          {!draft.items && (
            <button onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Icon d={ICON.image} />
              {uploading ? 'Subiendo…' : 'Imagen'}
            </button>
          )}
          <button className={draft.items ? 'active' : ''} onClick={toggleChecklist} aria-pressed={!!draft.items}>
            <Icon d={ICON.checklist} />
            Casillas
          </button>
          <button className={note.archived ? 'active' : ''} onClick={() => (openNote(null), update('notes', id, { ...draft, archived: !note.archived, pinned: false, updated_at: new Date().toISOString() }))}>
            <Icon d={ICON.archive} />
            {note.archived ? 'Desarchivar' : 'Archivar'}
          </button>
          <button className="danger" onClick={() => confirm(reminders.length ? '¿Borrar esta nota? Sus recordatorios se quedan.' : '¿Borrar esta nota?') && (openNote(null), dropNote())}>
            <Icon d={ICON.trash} />
            Borrar
          </button>
        </div>
      </nav>
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addPictures(e.target.files)} />
      {viewing && <Lightbox path={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

/** A picture in the text: tap to see it big, × to take it out. */
function NoteImage({ path, onOpen, onRemove }: { path: string; onOpen: (path: string) => void; onRemove: () => void }) {
  const url = useImageUrl(path)
  return (
    <figure className="note-img">
      {url ? <img src={url} alt="" loading="lazy" onClick={() => onOpen(path)} /> : <span className="note-img-wait" aria-hidden />}
      <button type="button" className="note-img-x" onClick={onRemove} aria-label="Quitar imagen"><Icon d={ICON.x} /></button>
    </figure>
  )
}

function Lightbox({ path, onClose }: { path: string; onClose: () => void }) {
  const url = useImageUrl(path)
  return <div className="lightbox" role="dialog" aria-label="Imagen" onClick={onClose}>{url && <img src={url} alt="" />}<button className="icon-btn lightbox-x" aria-label="Cerrar"><Icon d={ICON.x} /></button></div>
}

/** Keep-style list: Enter adds the next item, Backspace on an empty one removes it, ticked items sink to the bottom. */
function Checklist({ items, onChange }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
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
          {/* A textarea that grows, so a long item wraps onto more lines instead of being cut off. Enter still means «next item». */}
          <Grow
            rows={1}
            refCb={(el) => { refs.current[i] = el }}
            value={item.text}
            onChange={(e) => put(i, { text: e.target.value.replace(/\n/g, ' ') })}
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

/** A textarea as tall as its text, so the whole note scrolls as one page (CSS field-sizing isn't in every Safari yet). */
function Grow({ refCb, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { refCb?: (el: HTMLTextAreaElement | null) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [props.value])
  return <textarea ref={(el) => { ref.current = el; refCb?.(el) }} {...props} />
}
