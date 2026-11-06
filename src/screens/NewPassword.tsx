import { useState, type FormEvent } from 'react'
import { updatePassword } from '../store'

/** Opened from the «reset your password» email: the user is signed in for this, and chooses a new one. */
export default function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updatePassword(password)
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  return (
    <main className="screen login">
      <img className="login-logo" src="pwa-192x192.png" alt="" />
      <h1>Nueva contraseña</h1>
      <form className="form" onSubmit={save}>
        <input type="password" placeholder="Contraseña nueva (mín. 6)" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {error && <p className="danger small-text">{error}</p>}
        <button className="primary" disabled={busy || password.length < 6}>Guardar y entrar</button>
      </form>
    </main>
  )
}
