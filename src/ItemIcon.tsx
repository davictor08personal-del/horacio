import { useRef, useState } from 'react'
import { photoToIcon } from './media'

/** A project's or daily task's emoji or picture; without one, the first letter of its name on a soft tile. */
export function ItemIcon({ icon, name, big, small }: { icon: string | null; name: string; big?: boolean; small?: boolean }) {
  const cls = `project-icon ${big ? 'big' : ''} ${small ? 'small' : ''}`
  if (icon?.startsWith('data:image/')) return <img className={cls} src={icon} alt="" />
  if (icon) return <span className={`${cls} emoji`} aria-hidden>{icon}</span>
  return <span className={`${cls} letter`} aria-hidden>{name.trim().charAt(0).toUpperCase() || '·'}</span>
}

const EMOJIS = ['📁', '🏠', '📚', '🎓', '💼', '💻', '🏋️', '✈️', '💰', '🎨', '🎵', '❤️']
// Only the first emoji typed (one emoji can be several characters: 🏋️, 👨‍👩‍👧).
const firstEmoji = (s: string) => [...new Intl.Segmenter().segment(s.trim())][0]?.segment ?? ''

/** Pick an emoji (or type any), or upload a picture. Each choice is saved at once through onChange. */
export function IconPicker({ icon, onChange, emojis = EMOJIS, label = 'Icono' }: { icon: string | null; onChange: (icon: string | null) => void; emojis?: string[]; label?: string }) {
  const file = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const isPicture = icon?.startsWith('data:image/')
  const upload = async (f: File | undefined) => {
    if (!f) return
    setError('')
    try { onChange(await photoToIcon(f)) } catch { setError('No se pudo leer esa imagen.') }
  }
  return (
    <div className="field">{label}
      <div className="icon-picker">
        {emojis.map((e) => (
          <button key={e} type="button" className={`emoji-btn ${icon === e ? 'on' : ''}`} onClick={() => onChange(e)} aria-label={`Usar ${e}`}>{e}</button>
        ))}
      </div>
      <div className="icon-actions">
        <input className="emoji-input" defaultValue={isPicture ? '' : icon ?? ''} placeholder="Otro emoji" aria-label="Otro emoji"
          onBlur={(e) => { const v = firstEmoji(e.target.value); if (v && v !== icon) onChange(v) }} />
        <button type="button" className="secondary" onClick={() => file.current?.click()}>{isPicture ? 'Cambiar imagen' : 'Subir imagen'}</button>
        {icon && <button type="button" className="ghost" onClick={() => onChange(null)}>Quitar</button>}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      {error && <p className="danger small-text">{error}</p>}
    </div>
  )
}
