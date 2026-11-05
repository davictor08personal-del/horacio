import { useEffect, useState } from 'react'
import Sheet, { Choice } from './Sheet'
import { disablePush, enablePush, pushEnabled, pushSupport, testPush } from './push'
import { demo, signOut } from './store'
import { setTheme, THEME, useTheme } from './theme'

/** Ajustes, behind Horacio's face on Hoy: appearance, notifications and signing out. */
export default function Settings({ onClose }: { onClose: () => void }) {
  const theme = useTheme()
  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <div className="field">Apariencia
        <Choice value={theme} options={THEME} onChange={setTheme} />
      </div>
      <p className="hint">«Automático» sigue al móvil: claro de día, oscuro de noche si lo tienes así.</p>
      <Notifications />
      {!demo && <button className="ghost danger" onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && signOut()}>Cerrar sesión</button>}
    </Sheet>
  )
}

function Notifications() {
  const support = pushSupport()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { if (support === 'ok') pushEnabled().then(setOn, () => setOn(false)) }, [support])

  if (support === 'no') return null
  if (support === 'install') return <p className="hint">Para recibir avisos, añada Horacio a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábralo desde allí.</p>

  const run = (fn: () => Promise<unknown>, done: string) => async () => {
    setBusy(true); setMsg('')
    try { await fn(); setMsg(done); setOn(await pushEnabled()) } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="field">Avisos
      <p className="hint">Cada recordatorio a su hora y, a las 9:30, cómo viene el día.</p>
      {on
        ? <div className="row-actions">
            <button className="ghost" disabled={busy} onClick={run(testPush, 'Enviado: debería llegar en unos segundos.')}>Probar aviso</button>
            <button className="ghost" disabled={busy} onClick={run(disablePush, 'Avisos desactivados en este dispositivo.')}>Desactivar</button>
          </div>
        : <button disabled={busy || on === null} onClick={run(enablePush, 'Avisos activados.')}>Activar avisos</button>}
      {msg && <p className="hint">{msg}</p>}
    </div>
  )
}
