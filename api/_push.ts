// Shared by api/tick.ts and api/ping.ts: sends Web Push notifications to saved phones.
//
// Environment variables (Vercel): VITE_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY. The pair identifies our
// server to Apple/Google; generate it once with `npx web-push generate-vapid-keys`.
import webpush from 'web-push'
import { env, Failed } from './_auth.js'

/** A row of push_subscriptions (supabase/setup.sql): one per phone or browser that said yes. */
export type PushSub = { endpoint: string; p256dh: string; auth: string }
export type Message = { title: string; body: string; tag?: string }

// Only real push services: a saved row can't make the server send requests anywhere else.
const PUSH_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/

export function validEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.test(url.hostname)
  } catch {
    return false
  }
}

/** Sends `msg` to every subscription. Returns the endpoints that no longer exist (uninstalled, permission removed), to delete. */
export async function sendPush(subs: PushSub[], msg: Message) {
  const publicKey = env('VITE_VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) throw new Failed(503, 'missing VAPID keys')
  // Apple wants a real https or mailto contact here; Vercel sets the production domain.
  webpush.setVapidDetails(`https://${env('VERCEL_PROJECT_PRODUCTION_URL') ?? 'cuadre.vercel.app'}`, publicKey, privateKey)
  const gone: string[] = []
  await Promise.all(subs.filter((s) => validEndpoint(s.endpoint)).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600, urgency: 'high' })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) gone.push(s.endpoint)
      else console.error('push send', status ?? e)
    }
  }))
  return gone
}
