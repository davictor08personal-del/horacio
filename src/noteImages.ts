// Pictures inside notes. In Supabase they are files in the private bucket «note-images» (supabase/setup.sql),
// one folder per user; the note only keeps their path in a «[[img:…]]» line (see splitBody in logic.ts).
// In demo mode they are kept in localStorage, which is small: enough to try it.
import { useEffect, useState } from 'react'
import { photoToWebp } from './media'
import { supa } from './store'

const BUCKET = 'note-images'
const DEMO_PREFIX = 'cuadre-img:'
export const MAX_NOTE_IMAGES = 12

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result))
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})

/** Shrinks the photo and uploads it. Returns the path to put in the note. */
export async function uploadNoteImage(file: File): Promise<string> {
  const blob = await photoToWebp(file)
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const name = `${crypto.randomUUID()}.${ext}`
  if (!supa) {
    try { localStorage.setItem(DEMO_PREFIX + name, await blobToDataUrl(blob)) } catch { throw new Error('No cabe más en el modo demo.') }
    return `demo/${name}`
  }
  const { data } = await supa.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) throw new Error('Inicia sesión para subir imágenes.')
  const path = `${uid}/${name}`
  const { error } = await supa.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) throw new Error(error.message.includes('Bucket not found') ? 'Falta el bucket de imágenes: ejecuta supabase/setup.sql' : 'No se pudo subir la imagen.')
  return path
}

/** Deletes the files (best effort: a leftover file is harmless, a failed note save is not). */
export async function deleteNoteImages(paths: string[]) {
  if (!paths.length) return
  if (!supa) return paths.forEach((p) => { try { localStorage.removeItem(DEMO_PREFIX + p.replace(/^demo\//, '')) } catch { /* ignore */ } })
  await supa.storage.from(BUCKET).remove(paths).catch(() => {})
}

// Signed links last an hour; keep each one for 50 minutes so scrolling the list doesn't ask again.
const cache = new Map<string, { url: string; until: number }>()
const pending = new Map<string, Promise<string | null>>()

async function resolveUrl(path: string): Promise<string | null> {
  const hit = cache.get(path)
  if (hit && hit.until > Date.now()) return hit.url
  if (!supa) {
    let url: string | null = null
    try { url = localStorage.getItem(DEMO_PREFIX + path.replace(/^demo\//, '')) } catch { /* ignore */ }
    return url
  }
  let p = pending.get(path)
  if (!p) {
    p = supa.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) cache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60_000 })
      return data?.signedUrl ?? null
    }, () => null).finally(() => pending.delete(path))
    pending.set(path, p)
  }
  return p
}

/** The displayable address of a stored picture (null while loading or if it's gone). */
export function useImageUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | null>(() => (path ? cache.get(path)?.url ?? null : null))
  useEffect(() => {
    let alive = true
    setUrl(path ? cache.get(path)?.url ?? null : null)
    if (path) resolveUrl(path).then((u) => alive && setUrl(u))
    return () => { alive = false }
  }, [path])
  return url
}
