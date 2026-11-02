import { useEffect, useRef, useState } from 'react'
import type { Capture as Result, CaptureRequest } from '../capture'
import { dayName, shiftHours, shortDate } from '../logic'
import { MAX_SECONDS, photoToJpeg, startRecording } from '../media'
import { accessToken, insert, useData } from '../store'
import Sheet, { Choice } from '../Sheet'
import { EFFORT, PRIORITY, SHIFT } from '../types'

const ERRORS: Record<string, string> = {
  'not signed in': 'La sesión ha caducado: sal y vuelve a entrar.',
  'not allowed': 'Tu usuario no está en AI_ALLOWED_USERS (ver README).',
  'daily limit': 'Has llegado al límite de hoy de la IA.',
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
      if (!res.tasks.length && !res.shifts.length && !res.fp_tests.length && !res.projects.length) {
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
        placeholder="«Mañana sacar el dinero del alquiler, urgente»"
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

/** What the AI understood, editable. Nothing is saved until «Guardar». */
function Review({ result, onBack, onClose }: { result: Result; onBack: () => void; onClose: () => void }) {
  const { projects } = useData()
  const [r, setR] = useState(result)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  type Key = 'tasks' | 'shifts' | 'fp_tests' | 'projects'
  const edit = <K extends Key>(key: K, i: number, patch: Partial<Result[K][number]>) =>
    setR({ ...r, [key]: r[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const drop = (key: Key, i: number) => setR({ ...r, [key]: r[key].filter((_, j) => j !== i) })
  const count = r.tasks.length + r.shifts.length + r.fp_tests.length + r.projects.length

  async function save() {
    setBusy(true)
    try {
      // Projects first, so the new tasks can point at them by name.
      const created = await insert('projects', r.projects.map((p) => ({ ...p, status: 'activo' as const })))
      const byName = new Map([...projects, ...created].map((p) => [p.name.toLowerCase(), p.id]))
      await insert('tasks', r.tasks.map(({ project, ...t }) => ({ ...t, project_id: (project && byName.get(project.toLowerCase())) || null })))
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

      {r.tasks.map((t, i) => (
        <div className="review-card" key={`t${i}`}>
          <div className="review-head"><span className="review-kind">Tarea</span><button className="ghost" onClick={() => drop('tasks', i)}>Quitar</button></div>
          <input value={t.title} onChange={(e) => edit('tasks', i, { title: e.target.value })} aria-label="Título" />
          <Choice value={t.priority} options={PRIORITY} onChange={(priority) => edit('tasks', i, { priority })} />
          <Choice value={t.effort} options={EFFORT} onChange={(effort) => edit('tasks', i, { effort })} />
          <div className="two-col">
            <input type="date" value={t.due_date ?? ''} onChange={(e) => edit('tasks', i, { due_date: e.target.value || null })} aria-label="Fecha límite" />
            <input type="time" value={t.due_time ?? ''} onChange={(e) => edit('tasks', i, { due_time: e.target.value || null })} aria-label="Hora" />
          </div>
          {t.project && <p className="muted small-text">Proyecto: {t.project}</p>}
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
