import { useEffect, useState, type ReactNode } from 'react'
import Page from './Page'
import { Choice } from './Sheet'
import { disablePush, enablePush, pushEnabled, pushSupport, testPush } from './push'
import { currentSession, demo, signOut } from './store'
import { setTheme, THEME, useTheme } from './theme'

/**
 * Ajustes: a full screen with one card per section, opened from the gear on every screen.
 * A new setting is a new <Section> (or a row inside one).
 */
export default function Settings({ back, onClose }: { back: string; onClose: () => void }) {
  const theme = useTheme()
  const [email, setEmail] = useState('')
  useEffect(() => { currentSession().then((s) => setEmail(s?.user.email ?? '')) }, [])

  return (
    <Page back={back} onBack={onClose}>
      <h1 className="page-title">Ajustes</h1>

      <Section title="Apariencia" hint="«Automático» sigue al móvil: claro de día, oscuro de noche si lo tienes así.">
        <div className="settings-row"><Choice value={theme} options={THEME} onChange={setTheme} /></div>
      </Section>

      <Notifications />

      <Section title="Cuenta">
        {demo ? (
          <div className="settings-row"><span className="muted">Modo demo: los datos se guardan solo en este navegador.</span></div>
        ) : (
          <>
            <div className="settings-row"><span>Email</span><span className="muted settings-value">{email || '…'}</span></div>
            <button className="settings-row settings-action danger" onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && signOut()}>Cerrar sesión</button>
          </>
        )}
      </Section>

      <Section title="Acerca de">
        <div className="settings-row about">
          <img src="/pwa-64x64.png" alt="" width="40" height="40" />
          <span><strong>Cuadre</strong><br /><span className="muted small-text">Versión {__APP_VERSION__} · Qué hacer hoy y qué puede esperar</span></span>
        </div>
      </Section>
    </Page>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h2 className="settings-title">{title}</h2>
      <div className="settings-card">{children}</div>
      {hint && <p className="hint">{hint}</p>}
    </section>
  )
}

function Notifications() {
  const support = pushSupport()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { if (support === 'ok') pushEnabled().then(setOn, () => setOn(false)) }, [support])

  if (support === 'no') return null
  if (support === 'install') {
    return (
      <Section title="Avisos">
        <div className="settings-row"><span className="muted">Para recibir avisos, añade Cuadre a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrelo desde allí.</span></div>
      </Section>
    )
  }

  const run = (fn: () => Promise<unknown>, done: string) => async () => {
    setBusy(true); setMsg('')
    try { await fn(); setMsg(done); setOn(await pushEnabled()) } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Section title="Avisos" hint={msg || 'Cada recordatorio a su hora y, a las 9:30, cómo viene el día.'}>
      <div className="settings-row"><span>Avisos en este dispositivo</span><span className="muted settings-value">{on === null ? '…' : on ? 'Activados' : 'Desactivados'}</span></div>
      {on ? (
        <>
          <button className="settings-row settings-action" disabled={busy} onClick={run(testPush, 'Enviado: debería llegar en unos segundos.')}>Probar aviso</button>
          <button className="settings-row settings-action danger" disabled={busy} onClick={run(disablePush, 'Avisos desactivados en este dispositivo.')}>Desactivar</button>
        </>
      ) : (
        <button className="settings-row settings-action" disabled={busy || on === null} onClick={run(enablePush, 'Avisos activados.')}>Activar avisos</button>
      )}
    </Section>
  )
}
