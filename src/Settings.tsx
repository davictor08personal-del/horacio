import Sheet, { Choice } from './Sheet'
import { demo, signOut } from './store'
import { setTheme, THEME, useTheme } from './theme'

/** Ajustes, behind Horacio's monogram on Hoy: appearance for now, and signing out. */
export default function Settings({ onClose }: { onClose: () => void }) {
  const theme = useTheme()
  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <div className="field">Apariencia
        <Choice value={theme} options={THEME} onChange={setTheme} />
      </div>
      <p className="hint">«Automático» sigue al móvil: claro de día, oscuro de noche si lo tienes así.</p>
      {!demo && <button className="ghost danger" onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && signOut()}>Cerrar sesión</button>}
    </Sheet>
  )
}
