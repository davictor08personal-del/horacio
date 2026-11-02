// Shared by the server functions in api/. Files starting with "_" are not published as endpoints.
export const env = (k: string) => process.env[k]?.trim() || undefined

export class Failed extends Error {
  constructor(public status: number, public code: string) { super(code) }
}

/**
 * The Supabase user behind the request's token, plus a client that acts as them (RLS applies).
 * The app is public, so only the ids in AI_ALLOWED_USERS get through: they're the ones whose
 * keys and quota we pay for (the AI capture).
 */
export async function allowedUser(request: Request) {
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
  const allowed = (env('AI_ALLOWED_USERS') ?? '').split(',').map((s) => s.trim())
  if (!allowed.includes(data.user.id)) throw new Failed(403, 'not allowed')
  return { id: data.user.id, supa }
}

/** Server-side details (which variable is missing, provider status…) stay in Vercel's logs, never in the answer. */
export function errorResponse(e: unknown, tag: string) {
  const f = e instanceof Failed ? e : new Failed(502, 'error')
  console.error(tag, f.code, e instanceof Failed ? '' : e)
  return Response.json({ error: f.status >= 500 ? 'unavailable' : f.code }, { status: f.status })
}
