import { useState, type FormEvent } from 'react'
import { deviceTimeZone } from '../logic'
import { saveProfile } from '../store'

/**
 * First time signed in: the name for the greeting. The time zone is taken from the phone (changeable in Ajustes),
 * and the optional modules (shifts, studies) start off.
 */
export default function Welcome() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const start = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveProfile({ name: name.trim() || null, timezone: deviceTimeZone(), shifts: false, fp: false })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  return (
    <main className="screen login">
      <img className="login-logo" src="pwa-192x192.png" alt="" />
      <h1>Te damos la bienvenida</h1>
      <p className="muted">Proyectos, tareas, tareas diarias y notas, en un solo sitio. Apunta con ＋ escribiendo normal y Cuadre lo ordena.</p>
      <form className="form" onSubmit={start}>
        <input placeholder="¿Cómo te llamas?" autoComplete="given-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {error && <p className="danger small-text">{error}</p>}
        <button className="primary" disabled={busy}>Empezar</button>
      </form>
    </main>
  )
}
