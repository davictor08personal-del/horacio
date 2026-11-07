import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'

export const HOLD_DELETE_MS = 1800

/**
 * «¿Seguro que quieres borrar…?» A tap can't delete: the red button has to be held for about two seconds
 * (it fills while you hold; letting go early cancels). Also works from the keyboard (hold Enter or Space).
 */
export function ConfirmDelete({ title, detail, onConfirm, onClose }: { title: string; detail?: string; onConfirm: () => void | Promise<unknown>; onClose: () => void }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const start = () => {
    if (holding) return
    setHolding(true)
    navigator.vibrate?.(8)
    timer.current = window.setTimeout(async () => {
      navigator.vibrate?.([30, 40, 30])
      try { await onConfirm() } finally { onClose() }
    }, HOLD_DELETE_MS)
  }
  const stop = () => { clearTimeout(timer.current); setHolding(false) }
  return (
    <Sheet title="Borrar" onClose={onClose}>
      <div className="form">
        <p className="confirm-text"><strong>¿Seguro que quieres borrar «{title}»?</strong><br />{detail ?? 'No se puede deshacer.'}</p>
        <button
          type="button"
          className={`hold-btn ${holding ? 'holding' : ''}`}
          onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && (e.preventDefault(), start())}
          onKeyUp={stop} onBlur={stop}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="hold-fill" aria-hidden />
          <span className="hold-label">{holding ? 'Sigue pulsando…' : 'Mantén pulsado para borrar'}</span>
        </button>
        <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
      </div>
    </Sheet>
  )
}
