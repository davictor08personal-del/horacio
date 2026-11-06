// Shared by the server functions in api/. Files starting with "_" are not published as endpoints.
export const env = (k: string) => process.env[k]?.trim() || undefined

export class Failed extends Error {
  constructor(public status: number, public code: string) { super(code) }
}

/** The Supabase user behind the request's token, plus a client that acts as them (RLS applies). */
export async function signedInUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = env('VITE_SUPABASE_URL')
  const key = env('VITE_SUPABASE_KEY')
  // The logs say which of the three it was; the answer only says "not signed in".
  if (!url || !key) throw new Failed(503, 'server has no VITE_SUPABASE_URL/KEY')
  if (!token) { console.error('auth: no token'); throw new Failed(401, 'not signed in') }
  const { createClient } = await import('@supabase/supabase-js')
  const supa = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data, error } = await supa.auth.getUser(token)
  if (error || !data.user) { console.error('auth: token rejected', error?.status, error?.message); throw new Failed(401, 'not signed in') }
  return { id: data.user.id, supa }
}

/**
 * A signed-in user who may spend our AI: everyone, unless AI_ALLOWED_USERS lists ids (a closed beta).
 * What really caps the cost is the daily limit per user (ai_hit, AI_DAILY_LIMIT).
 */
export async function allowedUser(request: Request) {
  const user = await signedInUser(request)
  const allowed = (env('AI_ALLOWED_USERS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (allowed.length && !allowed.includes(user.id)) throw new Failed(403, 'not allowed')
  return user
}

/** A client with the secret key: bypasses RLS. Only for the cron and deleting an account. */
export async function adminClient() {
  const url = env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SECRET_KEY')
  if (!url || !key) throw new Failed(503, 'missing VITE_SUPABASE_URL/SUPABASE_SECRET_KEY')
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Server-side details (which variable is missing, provider status…) stay in Vercel's logs, never in the answer. */
export function errorResponse(e: unknown, tag: string) {
  const f = e instanceof Failed ? e : new Failed(502, 'error')
  console.error(tag, f.code, e instanceof Failed ? '' : e)
  return Response.json({ error: f.status >= 500 ? 'unavailable' : f.code }, { status: f.status })
}
