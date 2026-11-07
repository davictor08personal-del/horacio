import { useEffect, useRef, useState } from 'react'
import { colorParts, joinColor } from './logic'
import { DAILY_COLORS } from './types'

/** The colour swatches, and under them a 0-100 opacity slider (once a colour is picked). `value` is the stored text, e.g. «verde:80». */
export function ColorPicker({ value, onChange }: { value: string | null | undefined; onChange: (value: string) => void }) {
  const { key, alpha } = colorParts(value)
  const [live, setLive] = useState(alpha) // follows the finger; saved a moment after you stop
  const timer = useRef(0)
  useEffect(() => setLive(alpha), [alpha])
  useEffect(() => () => clearTimeout(timer.current), [])
  const slide = (n: number) => {
    setLive(n)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onChange(joinColor(key, n)), 250)
  }
  return (
    <>
      <div className="color-picker">
        {Object.entries(DAILY_COLORS).map(([k, label]) => (
          <button key={k} type="button" className={`swatch dc-${k} ${key === k ? 'on' : ''}`} onClick={() => onChange(joinColor(k, alpha))} aria-label={label} title={label} />
        ))}
      </div>
      {key !== 'none' && (
        <label className="opacity-row">
          <span>Opacidad</span>
          <input type="range" min={0} max={100} step={5} value={live} onChange={(e) => slide(Number(e.target.value))} aria-label="Opacidad del color" />
          <output>{live}</output>
        </label>
      )}
    </>
  )
}
