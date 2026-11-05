import { useEffect, useRef, useState } from 'react'
import type { Capture as Result, CapturedTask, CaptureRequest } from '../capture'
import { dayName, madridDay, shiftHours, shortDate, toChecklist } from '../logic'
import { MAX_SECONDS, photoToJpeg, startRecording } from '../media'
import { accessToken, insert, useData } from '../store'
import Sheet, { Choice } from '../Sheet'
import { EFFORT, PRIORITY, SHIFT, type Effort, type Priority } from '../types'

const ERRORS: Record<string, string> = {
  'not signed in': 'La sesión ha caducado: sal y vuelve a entrar.',
  'not allowed': 'Tu usuario no está en AI_ALLOWED_USERS (ver README).',
  'daily limit': 'Has llegado al límite de hoy de la IA.',
  'text only': 'Con DeepSeek solo funciona el texto: escríbelo en vez de foto o voz.',
  'too big': 'Es demasiado grande. Prueba con una foto más pequeña o un audio más corto.',
  'unsupported media': 'Ese tipo de archivo no lo entiende la IA.',
}

/** ＋: write, dictate or send a photo → the AI says what it understood → you fix it → Guardar. */
export default function Capture({ onClose }: { onClose: () => void }) {
  const { projects } = useData()
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<{ mime: string; data: string; url: string } | null>(null)
  const [recording, setRecording] = useState<Awaited<ReturnType<typeof startRecording>> | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function ask(media?: CaptureRequest['media']) {
    setBusy(true)
    setError('')
    try {
      const token = await accessToken()
      const body: CaptureRequest = { text, media, projects: projects.filter((p) => p.status !== 'hecho').map((p) => p.name) }
      const r = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({ error: 'unavailable' }))
      if (!r.ok) throw new Error(ERRORS[j.error] ?? 'La IA no está disponible ahora. Inténtalo en un rato.')
      const res = j as Result
      if (!res.tasks.length && !res.notes.length && !res.daily_tasks.length && !res.shifts.length && !res.fp_tests.length && !res.projects.length) {
        throw new Error(res.note ?? 'No he entendido nada que apuntar. Prueba a decirlo de otra forma.')
      }
      setResult(res)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  // Recording: a counter, and it stops by itself at the limit.
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])
  useEffect(() => { if (seconds >= MAX_SECONDS) stopRecording() })

  async function record() {
    setError('')
    try {
      setSeconds(0)
      setRecording(await startRecording())
    } catch {
      setError('Sin acceso al micrófono. Actívalo en Ajustes → Safari → Micrófono (o usa el 🎙️ del teclado).')
    }
  }
  async function stopRecording() {
    if (!recording) return
    const r = recording
    setRecording(null)
    try {
      await ask(await r.stop())
    } catch {
      setError('No se pudo leer la grabación.')
    }
  }
  // Closing the sheet mid-recording turns the microphone off.
  const live = useRef(recording)
  live.current = recording
  useEffect(() => () => live.current?.cancel(), [])

  async function pickPhoto(file?: File) {
    if (!file) return
    try {
      setPhoto(await photoToJpeg(file))
    } catch {
      setError('No se pudo abrir la foto.')
    }
  }

  if (result) return <Review result={result} onBack={() => setResult(null)} onClose={onClose} />

  return (
    <Sheet title="Apuntar" onClose={onClose}>
      <textarea
        className="capture-text"
        rows={4}
        autoFocus
        placeholder="«Recuérdame llamar al casero mañana a las 12», «idea: …», «meditar todos los días»"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy || !!recording}
      />
      {photo && (
        <div className="photo-chip">
          <img src={photo.url} alt="" />
          <span>Foto adjunta</span>
          <button className="ghost" onClick={() => setPhoto(null)}>Quitar</button>
        </div>
      )}
      {error && <p className="danger small-text">{error}</p>}
      {recording ? (
        <button className="primary recording" onClick={stopRecording}>■ Parar y enviar · {MAX_SECONDS - seconds}s</button>
      ) : (
        <div className="capture-actions">
          <button className="secondary icon-btn" onClick={record} disabled={busy} aria-label="Dictar">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          <button className="secondary icon-btn" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Foto o captura">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" /></svg>
          </button>
          <button className="primary grow-btn" disabled={busy || (!text.trim() && !photo)} onClick={() => ask(photo ?? undefined)}>
            {busy ? 'Pensando…' : 'Entender'}
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
    </Sheet>
  )
}

type Kind = 'tarea' | 'recordatorio' | 'nota' | 'diaria'
const KIND: Record<Kind, string> = { tarea: 'Tarea', recordatorio: 'Recordatorio', nota: 'Nota', diaria: 'Diaria' }

/** One thing to do or keep, whatever the AI thought it was: changing its kind keeps what's typed. */
interface Item {
  kind: Kind
  title: string
  details: string // a task's «Detalles» or a note's text (one line per item if it's a checklist)
  checklist: boolean
  priority: Priority
  effort: Effort
  status: CapturedTask['status']
  due_date: string | null
  due_time: string | null
  area: string | null
  project: string | null
  ask_project: boolean
}

const BLANK = { details: '', checklist: false, priority: 'media', effort: 'medio', status: 'abierto', due_date: null, due_time: null, area: null, project: null, ask_project: false } as const

function toItems(r: Result): Item[] {
  return [
    ...r.tasks.map((t): Item => ({ ...BLANK, ...t, kind: t.due_time ? 'recordatorio' : 'tarea', details: t.details ?? '' })),
    ...r.notes.map((n): Item => ({ ...BLANK, kind: 'nota', title: n.title, details: n.items ? n.items.join('\n') : n.body, checklist: !!n.items, project: n.project, ask_project: n.ask_project })),
    ...r.daily_tasks.map((d): Item => ({ ...BLANK, kind: 'diaria', title: d.title })),
  ]
}

/** What the AI understood, editable. Nothing is saved until «Guardar». */
function Review({ result, onBack, onClose }: { result: Result; onBack: () => void; onClose: () => void }) {
  const { projects, daily_tasks } = useData()
  const [r, setR] = useState(result)
  const [items, setItems] = useState(() => toItems(result))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  type Key = 'shifts' | 'fp_tests' | 'projects'
  const edit = <K extends Key>(key: K, i: number, patch: Partial<Result[K][number]>) =>
    setR({ ...r, [key]: r[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const drop = (key: Key, i: number) => setR({ ...r, [key]: r[key].filter((_, j) => j !== i) })
  const editItem = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const count = items.length + r.shifts.length + r.fp_tests.length + r.projects.length
  // Existing projects plus the ones this capture is about to create, so a task can already go in a new one.
  const projectNames = [...new Set([...projects.filter((p) => p.status !== 'hecho').map((p) => p.name), ...r.projects.map((p) => p.name).filter(Boolean)])]

  // A reminder has a day and a time; switching to it fills what's missing, switching to a task drops the time.
  function retype(i: number, kind: Kind) {
    const it = items[i]
    if (kind === 'recordatorio') return editItem(i, { kind, due_date: it.due_date ?? madridDay(), due_time: it.due_time ?? '09:00' })
    editItem(i, { kind, due_time: kind === 'tarea' ? null : it.due_time })
  }

  async function save() {
    setBusy(true)
    try {
      // Projects first, so the new tasks and notes can point at them by name.
      const created = await insert('projects', r.projects.map((p) => ({ ...p, status: 'activo' as const })))
      const byName = new Map([...projects, ...created].map((p) => [p.name.toLowerCase(), p.id]))
      const projectId = (name: string | null) => (name && byName.get(name.toLowerCase())) || null
      const of = (k: Kind) => items.filter((it) => it.kind === k && (it.title.trim() || (k === 'nota' && it.details.trim())))
      await insert('tasks', [...of('tarea'), ...of('recordatorio')].map((t) => ({
        title: t.title.trim(), notes: t.details.trim() || null, priority: t.priority, effort: t.effort, status: t.status,
        due_date: t.due_date, due_time: t.kind === 'recordatorio' ? t.due_time : null, area: t.area, project_id: projectId(t.project), note_id: null, done_at: null,
      })))
      const now = new Date().toISOString()
      await insert('notes', of('nota').map((n) => ({
        title: n.title.trim(), body: n.checklist ? '' : n.details.trim(), items: n.checklist ? toChecklist(n.details) : null,
        color: 'none' as const, project_id: projectId(n.project), pinned: false, archived: false, updated_at: now,
      })))
      await insert('daily_tasks', of('diaria').map((d, i) => ({ title: d.title.trim(), position: daily_tasks.length + i, done_on: null })))
      await insert('shifts', r.shifts)
      await insert('fp_tests', r.fp_tests.map((t) => ({ ...t, read: false })))
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title="Esto he entendido" onClose={onClose}>
      {r.note && <p className="ai-note">{r.note}</p>}

      {items.map((t, i) => (
        <div className="review-card" key={`i${i}`}>
          <div className="review-head">
            <Choice value={t.kind} options={KIND} onChange={(k) => retype(i, k)} />
            <button className="ghost remove" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Quitar"><svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          </div>
          <input value={t.title} onChange={(e) => editItem(i, { title: e.target.value })} placeholder={t.kind === 'nota' ? 'Título' : '¿Qué hay que hacer?'} aria-label="Título" />
          {t.kind === 'tarea' && (
            <>
              <Choice value={t.priority} options={PRIORITY} onChange={(priority) => editItem(i, { priority })} />
              <Choice value={t.effort} options={EFFORT} onChange={(effort) => editItem(i, { effort })} />
              <input type="date" value={t.due_date ?? ''} onChange={(e) => editItem(i, { due_date: e.target.value || null })} aria-label="Fecha límite" />
            </>
          )}
          {t.kind === 'recordatorio' && (
            <div className="two-col">
              <input type="date" value={t.due_date ?? ''} onChange={(e) => editItem(i, { due_date: e.target.value || null })} aria-label="Día" />
              <input type="time" value={t.due_time ?? ''} onChange={(e) => editItem(i, { due_time: e.target.value || null })} aria-label="Hora" />
            </div>
          )}
          {t.kind === 'nota' && (
            <>
              <textarea rows={3} value={t.details} onChange={(e) => editItem(i, { details: e.target.value })} placeholder={t.checklist ? 'Un elemento por línea' : 'Texto'} aria-label="Texto" />
              <label className="check-line"><input type="checkbox" checked={t.checklist} onChange={(e) => editItem(i, { checklist: e.target.checked })} />Lista de casillas</label>
            </>
          )}
          {t.kind === 'diaria' && <p className="muted small-text">Saldrá cada día en Hoy, para tacharla.</p>}
          {t.kind !== 'diaria' && (projectNames.length > 0 || t.project) && (
            <label className={`field ${t.ask_project && !t.project ? 'asking' : ''}`}>
              {t.ask_project && !t.project ? '¿De qué proyecto es?' : 'Proyecto'}
              <select value={t.project ?? ''} onChange={(e) => editItem(i, { project: e.target.value || null, ask_project: false })}>
                <option value="">Ninguno</option>
                {[...new Set([...projectNames, ...(t.project ? [t.project] : [])])].map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          )}
        </div>
      ))}

      {r.shifts.length > 0 && (
        <div className="review-card">
          <div className="review-head"><span className="review-kind">Turnos</span></div>
          {r.shifts.map((s, i) => (
            <div className="review-shift" key={s.day}>
              <span>{dayName(s.day)} {shortDate(s.day)}</span>
              <select value={s.kind} onChange={(e) => { const kind = e.target.value as typeof s.kind; edit('shifts', i, { kind, ...shiftHours(kind, s.day) }) }}>
                {Object.entries(SHIFT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className="muted small-text">{s.starts_at ? `${s.starts_at}–${s.ends_at}` : ''}</span>
              <button className="ghost" onClick={() => drop('shifts', i)} aria-label="Quitar"><svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg></button>
            </div>
          ))}
        </div>
      )}

      {r.fp_tests.map((t, i) => (
        <div className="review-card" key={`f${i}`}>
          <div className="review-head"><span className="review-kind">Test FP · {t.subject}</span><button className="ghost" onClick={() => drop('fp_tests', i)}>Quitar</button></div>
          <input value={t.unit} onChange={(e) => edit('fp_tests', i, { unit: e.target.value })} aria-label="Unidad" />
          <div className="two-col">
            <label className="field">Abre<input type="date" value={t.opens_on ?? ''} onChange={(e) => edit('fp_tests', i, { opens_on: e.target.value || null })} /></label>
            <label className="field">Cierra<input type="date" value={t.closes_on ?? ''} onChange={(e) => edit('fp_tests', i, { closes_on: e.target.value || null })} /></label>
          </div>
        </div>
      ))}

      {r.projects.map((p, i) => (
        <div className="review-card" key={`p${i}`}>
          <div className="review-head"><span className="review-kind">Proyecto nuevo</span><button className="ghost" onClick={() => drop('projects', i)}>Quitar</button></div>
          <input value={p.name} onChange={(e) => edit('projects', i, { name: e.target.value })} aria-label="Nombre" />
          <input value={p.next_step ?? ''} placeholder="Siguiente paso" onChange={(e) => edit('projects', i, { next_step: e.target.value || null })} />
        </div>
      ))}

      {error && <p className="danger small-text">{error}</p>}
      <button className="primary" disabled={busy || !count} onClick={save}>{busy ? 'Guardando…' : `Guardar${count > 1 ? ` (${count})` : ''}`}</button>
      <button className="ghost" onClick={onBack}>Volver a escribir</button>
    </Sheet>
  )
}
