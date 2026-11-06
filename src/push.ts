// The phone side of the notifications (server: api/tick.ts). The phone gives us an address
// (a "subscription"); we save it in Supabase and the server sends the reminders there.
import { accessToken, demo, supa } from './store'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** 'ok' = this browser can do it. On iPhone, Safari only allows notifications once the app is on the home screen. */
export function pushSupport(): 'ok' | 'install' | 'no' {
  if (demo || !PUBLIC_KEY || !('serviceWorker' in navigator)) return 'no'
  if (!('PushManager' in window) || !('Notification' in window)) return /iPhone|iPad/.test(navigator.userAgent) ? 'install' : 'no'
  return 'ok'
}

// The key travels as base64url text; the browser wants the raw bytes.
const bytes = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0))

// In `npm run dev` there's no service worker, so `ready` would wait forever.
const registration = () => Promise.race([
  navigator.serviceWorker.ready,
  new Promise<never>((_, no) => setTimeout(() => no(new Error('Sin service worker: los avisos solo van en la app publicada')), 4000)),
])

export async function pushEnabled() {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return false
  return !!(await (await registration()).pushManager.getSubscription().catch(() => null))
}

/** Asks for permission (must follow a tap) and saves this phone's address. */
export async function enablePush() {
  if (await Notification.requestPermission() !== 'granted') throw new Error('Permiso denegado: actívalo en Ajustes del iPhone → Notificaciones → Cuadre')
  const reg = await registration()
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(PUBLIC_KEY!) }))
  const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supa!.from('push_subscriptions').upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
  if (error) throw new Error(error.message.includes('does not exist') ? 'Falta la tabla: ejecuta supabase/setup.sql' : error.message)
}

export async function disablePush() {
  const sub = await (await registration()).pushManager.getSubscription()
  if (!sub) return
  await supa!.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Asks the server for a test notification. */
export async function testPush() {
  const r = await fetch('/api/ping', { method: 'POST', headers: { Authorization: `Bearer ${await accessToken()}` } })
  if (!r.ok) throw new Error(r.status === 403 ? 'Tu usuario no está en AI_ALLOWED_USERS' : 'El servidor no pudo enviarlo')
}
