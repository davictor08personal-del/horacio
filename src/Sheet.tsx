import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Panel at the bottom over a dimmed background (same as Músculo, without the slide-in). Tapping outside closes it. */
export default function Sheet({ title, onClose, actions, children }: { title: string; onClose: () => void; actions?: ReactNode; children: ReactNode }) {
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <span className="sheet-actions">{actions}<button className="ghost" onClick={onClose}>Cerrar</button></span>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Row of pill buttons to pick one value (priority, effort, shift…). */
export function Choice<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="choice">
      {(Object.keys(options) as T[]).map((k) => (
        <button type="button" key={k} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>{options[k]}</button>
      ))}
    </div>
  )
}

/** Big text tabs with a small count badge each («Puntuales 10 · Diarias 4»), for switching a whole screen's view. */
export function ViewTabs<T extends string>({ value, options, counts, onChange }: { value: T; options: Record<T, string>; counts?: Partial<Record<T, number>>; onChange: (v: T) => void }) {
  return (
    <div className="view-tabs" role="tablist">
      {(Object.keys(options) as T[]).map((k) => (
        <button type="button" role="tab" aria-selected={k === value} key={k} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>
          {options[k]}{counts?.[k] != null && <span className="view-count">{counts[k]}</span>}
        </button>
      ))}
    </div>
  )
}
