// The phone side of the notifications (server: api/tick.ts). The phone gives us an address
// (a "subscription"); we save it in Supabase and the server sends the reminders there.
// In addition, while the app is open (or in demo/local mode), checkDueReminders fires local notifications on time.
import { dueReminders, hhmm } from './logic'
import { accessToken, demo, supa, update } from './store'
import type { Task } from './types'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** 'ok' = this browser can do server Web Push. On iPhone, Safari only allows notifications once the app is on the home screen. */
export function pushSupport(): 'ok' | 'install' | 'no' {
  if (demo || !PUBLIC_KEY || !('serviceWorker' in navigator)) return 'no'
  if (!('PushManager' in window) || !('Notification' in window)) return /iPhone|iPad/.test(navigator.userAgent) ? 'install' : 'no'
  return 'ok'
}

/** Browser/PWA notification permission state (works in demo, local dev and production). */
export function notificationState(): NotificationPermission | 'install' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return typeof navigator !== 'undefined' && /iPhone|iPad/.test(navigator.userAgent) ? 'install' : 'unsupported'
  }
  return Notification.permission
}

/** Asks for notification permission and, if Web Push is configured, subscribes this device too. */
export async function ensureNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') return false
  if (pushSupport() === 'ok') await enablePush().catch(() => {})
  return true
}

/** Shows a native system notification via Service Worker (best on mobile) or Notification API fallback. */
export async function showLocalNotification(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, { body, icon: '/pwa-192x192.png', tag })
      return
    }
  } catch { /* fallback below */ }
  try {
    new Notification(title, { body, icon: '/pwa-192x192.png', tag })
  } catch { /* ignore if blocked by OS */ }
}

const firedKeys = new Set<string>()

/** Checks open tasks whose reminder date + time has arrived and triggers their notification once. */
export function checkDueReminders(tasks: Task[], onFire?: (t: Task) => void) {
  const due = dueReminders(tasks)
  for (const t of due) {
    const key = `${t.id}:${t.due_date}:${hhmm(t.due_time)}`
    if (t.notified_at || firedKeys.has(key)) continue
    firedKeys.add(key)
    update('tasks', t.id, { notified_at: new Date().toISOString() }).catch(() => {})
    void showLocalNotification('Recordatorio', t.title, t.id)
    navigator.vibrate?.([120, 60, 120])
    onFire?.(t)
  }
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
  if (!r.ok) throw new Error('El servidor no pudo enviarlo')
  const { sent } = (await r.json().catch(() => ({ sent: 0 }))) as { sent?: number }
  if (!sent) throw new Error('Este dispositivo no tenía suscripción activa. Pulsa Desactivar y vuelve a activar los avisos.')
}
