import { useState, type FormEvent } from 'react'
import { signIn, signUp } from '../store'

/** Cuadre has no offline mode: the data lives in Supabase, so the first thing is signing in. */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = (fn: typeof signIn) => async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      await fn(email.trim(), password)
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  return (
    <main className="screen login">
      <img className="login-logo" src="pwa-192x192.png" alt="" />
      <h1>Cuadre</h1>
      <p className="muted">Qué hacer hoy, qué puede esperar y cuándo avisarte.</p>
      <form className="form" onSubmit={run(signIn)}>
        <input type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        {error && <p className="danger small-text">{error}</p>}
        <button className="primary" disabled={busy}>Entrar</button>
        <button type="button" className="ghost" disabled={busy || !email || password.length < 6} onClick={() => run(signUp)()}>Crear cuenta</button>
      </form>
    </main>
  )
}
