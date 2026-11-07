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
export function IconPicker({ icon, onChange, emojis = EMOJIS, label = 'Imagen o icono' }: { icon: string | null; onChange: (icon: string | null) => void; emojis?: string[]; label?: string }) {
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
      {isPicture ? (
        <div className="image-preview-card">
          <img className="image-thumb" src={icon!} alt="Vista previa de la imagen" />
          <div className="image-thumb-info">
            <span className="small-text">Imagen personalizada</span>
            <div className="row-actions">
              <button type="button" className="secondary small-btn" onClick={() => file.current?.click()}>Cambiar foto</button>
              <button type="button" className="ghost danger small-btn" onClick={() => onChange(null)}>Quitar</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="upload-photo-btn" onClick={() => file.current?.click()}>
          <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          <span>Subir imagen o foto</span>
        </button>
      )}

      <div className="icon-picker">
        {emojis.map((e) => (
          <button key={e} type="button" className={`emoji-btn ${icon === e ? 'on' : ''}`} onClick={() => onChange(e)} aria-label={`Usar ${e}`}>{e}</button>
        ))}
      </div>
      <div className="icon-actions">
        <input className="emoji-input" defaultValue={isPicture ? '' : icon ?? ''} placeholder="O escribe otro emoji" aria-label="Otro emoji"
          onBlur={(e) => { const v = firstEmoji(e.target.value); if (v && v !== icon) onChange(v) }} />
        {!isPicture && icon && <button type="button" className="ghost" onClick={() => onChange(null)}>Quitar</button>}
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      {error && <p className="danger small-text">{error}</p>}
    </div>
  )
}
