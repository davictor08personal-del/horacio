import { useState, type FormEvent } from 'react'
import Captcha, { captchaEnabled } from '../Captcha'
import { resetPassword, signIn, signUp } from '../store'

/** Cuadre has no offline mode: the data lives in Supabase, so the first thing is signing in. */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [round, setRound] = useState(0) // a new Turnstile widget (and token) after every attempt
  const blocked = captchaEnabled && !token
  const nextRound = () => { setToken(null); setRound((r) => r + 1) }

  const run = (fn: typeof signIn) => async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await fn(email.trim(), password, token ?? undefined)
    } catch (err) {
      setError((err as Error).message)
    }
    if (captchaEnabled) nextRound()
    setBusy(false)
  }

  async function forgot() {
    setError('')
    setInfo('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Escribe arriba tu email y vuelve a pulsar.')
    setBusy(true)
    try {
      await resetPassword(email.trim(), token ?? undefined)
      setInfo('Si ese email tiene cuenta, te hemos enviado un enlace para elegir una contraseña nueva. Mira también en spam.')
    } catch (err) {
      setError((err as Error).message)
    }
    if (captchaEnabled) nextRound()
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
        {info && <p className="small-text">{info}</p>}
        <Captcha key={round} onToken={setToken} />
        <button className="primary" disabled={busy || blocked}>Entrar</button>
        <button type="button" className="ghost" disabled={busy || blocked || !email || password.length < 6} onClick={() => run(signUp)()}>Crear cuenta</button>
        <button type="button" className="link" disabled={busy || blocked} onClick={forgot}>¿Olvidaste tu contraseña?</button>
      </form>
      <p className="hint legal">Al crear una cuenta aceptas la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a>.</p>
    </main>
  )
}
