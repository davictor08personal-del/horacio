import { useEffect, useState, type ReactNode } from 'react'
import Page from './Page'
import { Choice } from './Sheet'
import { disablePush, enablePush, pushEnabled, pushSupport, testPush } from './push'
import { deviceTimeZone, timeZone } from './logic'
import { currentSession, deleteAccount, demo, saveProfile, signOut, useData } from './store'
import { setTheme, THEME, useTheme } from './theme'

/**
 * Ajustes: a full screen with one card per section, opened from the gear on every screen.
 * A new setting is a new <Section> (or a row inside one).
 */
export default function Settings({ back, onClose }: { back: string; onClose: () => void }) {
  const theme = useTheme()
  const { profile } = useData()
  const [email, setEmail] = useState('')
  useEffect(() => { currentSession().then((s) => setEmail(s?.user.email ?? '')) }, [])

  return (
    <Page back={back} onBack={onClose}>
      <h1 className="page-title">Ajustes</h1>

      <Section title="Perfil">
        <label className="settings-row"><span>Nombre</span>
          <input className="settings-input" defaultValue={profile?.name ?? ''} placeholder="Tu nombre" maxLength={60}
            onBlur={(e) => e.target.value.trim() !== (profile?.name ?? '') && saveProfile({ name: e.target.value.trim() || null })} />
        </label>
        <label className="settings-row"><span>Zona horaria</span>
          <select className="settings-input" value={timeZone()} onChange={(e) => saveProfile({ timezone: e.target.value })}>
            {zones(timeZone()).map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
      </Section>

      <Section title="Módulos" hint="Partes opcionales: actívalas solo si te sirven. Salen en Hoy, bajo el saludo.">
        <Toggle label="Turnos de trabajo" sub="Tus turnos de la semana y el tiempo libre de cada día" on={!!profile?.shifts} onChange={(shifts) => saveProfile({ shifts })} />
        <Toggle label="Estudios" sub="Tests por bloques, con fechas de apertura y cierre" on={!!profile?.fp} onChange={(fp) => saveProfile({ fp })} />
      </Section>

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
            <button className="settings-row settings-action" onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && signOut()}>Cerrar sesión</button>
            <button className="settings-row settings-action danger" onClick={removeAccount}>Borrar mi cuenta</button>
          </>
        )}
      </Section>

      <Section title="Acerca de">
        <div className="settings-row about">
          <img src="/pwa-64x64.png" alt="" width="40" height="40" />
          <span><strong>Cuadre</strong><br /><span className="muted small-text">Versión {__APP_VERSION__} · Qué hacer hoy y qué puede esperar</span></span>
        </div>
        <a className="settings-row settings-action" href="/privacidad.html" target="_blank" rel="noopener">Política de privacidad</a>
      </Section>
    </Page>
  )
}

/** Two confirmations: it deletes everything, for good. */
async function removeAccount() {
  if (!confirm('¿Borrar tu cuenta? Se borran para siempre tus tareas, notas, proyectos y tareas diarias.')) return
  if (prompt('Para confirmarlo, escribe BORRAR') !== 'BORRAR') return
  try { await deleteAccount() } catch (e) { alert((e as Error).message) }
}

/** The time zones to choose from: the current one, the phone's, and the usual ones for Spain and Latin America. */
const COMMON_ZONES = ['Europe/Madrid', 'Atlantic/Canary', 'America/Caracas', 'America/Bogota', 'America/Lima', 'America/Mexico_City', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Panama', 'America/New_York', 'Europe/London']
const zones = (current: string) => [...new Set([current, deviceTimeZone(), ...COMMON_ZONES])]

function Toggle({ label, sub, on, onChange }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-row toggle-row">
      <span className="toggle-text"><span>{label}</span><span className="muted small-text">{sub}</span></span>
      <input type="checkbox" className="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
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
