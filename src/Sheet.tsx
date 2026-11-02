import type { ReactNode } from 'react'

/** Panel at the bottom over a dimmed background (same as Músculo, without the slide-in). Tapping outside closes it. */
export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose}>Cerrar</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
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
