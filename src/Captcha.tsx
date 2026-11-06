// Cloudflare Turnstile: proves a real person is signing in or up, usually without them doing anything.
// Off until VITE_TURNSTILE_SITE_KEY is set. Order matters (README): first the site key in Vercel and publish,
// then switch on «Captcha protection» in Supabase — the other way round, nobody could sign in.
import { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
export const captchaEnabled = !!SITE_KEY

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }

let loading: Promise<void> | null = null
const loadScript = () => (loading ??= new Promise<void>((resolve, reject) => {
  const s = document.createElement('script')
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  s.async = true
  s.onload = () => resolve()
  s.onerror = () => { loading = null; reject(new Error('turnstile')) }
  document.head.append(s)
}))

/**
 * The widget. Each token works once, so after every attempt the parent changes `key` to get a fresh one.
 * `onToken(null)` when it expires or fails.
 */
export default function Captcha({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cb = useRef(onToken)
  cb.current = onToken
  useEffect(() => {
    if (!SITE_KEY) return
    let id: string | undefined
    let gone = false
    loadScript().then(() => {
      if (gone || !box.current || !window.turnstile) return
      id = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
        theme: 'auto',
        language: 'es',
        size: 'flexible',
      })
    }).catch(() => cb.current(null))
    return () => { gone = true; if (id) window.turnstile?.remove(id) }
  }, [])
  return SITE_KEY ? <div ref={box} className="captcha" /> : null
}
