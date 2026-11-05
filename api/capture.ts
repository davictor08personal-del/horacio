// POST /api/capture: turns free text, a voice recording or a photo into tasks, shifts, FP tests and projects.
// Runs on Vercel's servers (and on `npm run dev` through vite.config.ts), never in the browser:
// it's the only place that sees the AI keys, so the key can't be read from the app.
//
// Environment variables (.env.local locally, Vercel → Settings → Environment Variables once published):
//   AI_PROVIDER        gemini | deepseek | mock (canned answers, no key, no cost)
//   AI_MODEL           optional, default gemini-flash-latest (Google points it at its newest Flash)
//   GEMINI_API_KEY     from Google AI Studio (aistudio.google.com → Get API key)
//   DEEPSEEK_API_KEY   from platform.deepseek.com → API keys. DeepSeek only reads text: photos and voice
//                      still go to Gemini when GEMINI_API_KEY is set.
//   DEEPSEEK_MODEL     optional, default deepseek-chat
//   AI_ALLOWED_USERS   Supabase user ids allowed to use it, comma-separated
//   AI_DAILY_LIMIT     calls per user and day (default 40)
//   VITE_SUPABASE_URL / VITE_SUPABASE_KEY: used to check who calls
import { buildCapturePrompt, CAPTURE_SCHEMA, cleanCapture, mockCapture, type CaptureRequest } from '../src/capture.js'
import { madridDay } from '../src/logic.js'
import { allowedUser, env, errorResponse, Failed } from './_auth.js'

const MAX_BODY = 4_000_000 // characters: a 60 s recording or a phone photo, in base64, fits well under it
const MEDIA = /^(image\/(jpeg|png|webp|heic)|audio\/(wav|mp3|mpeg|aac|ogg|flac))$/

async function gemini(system: string, req: CaptureRequest) {
  const key = env('GEMINI_API_KEY')
  if (!key) throw new Failed(503, 'missing GEMINI_API_KEY')
  const model = env('AI_MODEL') ?? 'gemini-flash-latest'
  const parts: object[] = [{ text: req.text?.trim() || 'Mira el adjunto.' }]
  if (req.media) parts.push({ inline_data: { mime_type: req.media.mime, data: req.media.data } })
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: CAPTURE_SCHEMA, temperature: 0.2, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(40_000),
  })
  // 429 = free-tier limit reached for now; 400 = something it didn't like (e.g. audio format). Both in Vercel's logs.
  if (!r.ok) throw new Failed(502, `provider ${r.status} ${(await r.text()).slice(0, 300)}`)
  const j = await r.json()
  console.log('ai usage', model, JSON.stringify(j.usageMetadata ?? {}))
  const out = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
  try {
    return JSON.parse(out)
  } catch {
    throw new Failed(502, 'answer is not JSON')
  }
}

// OpenAI-style API. No schema support like Gemini's, so the schema goes in the prompt and
// cleanCapture() throws away anything that doesn't fit.
async function deepseek(system: string, req: CaptureRequest) {
  const key = env('DEEPSEEK_API_KEY')
  if (!key) throw new Failed(503, 'missing DEEPSEEK_API_KEY')
  const model = env('DEEPSEEK_MODEL') ?? 'deepseek-chat'
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: `${system}

Responde SOLO con un objeto JSON que siga este esquema (todas las listas presentes, vacías si no hay nada):
${JSON.stringify(CAPTURE_SCHEMA)}` },
        { role: 'user', content: req.text!.trim() },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(40_000),
  })
  // 401 = wrong key; 402 = no balance left. Both in Vercel's logs.
  if (!r.ok) throw new Failed(502, `provider ${r.status} ${(await r.text()).slice(0, 300)}`)
  const j = await r.json()
  console.log('ai usage', model, JSON.stringify(j.usage ?? {}))
  try {
    return JSON.parse(j.choices?.[0]?.message?.content ?? '')
  } catch {
    throw new Failed(502, 'answer is not JSON')
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY) throw new Failed(413, 'too big')
    let req: CaptureRequest
    try {
      req = JSON.parse(raw)
    } catch {
      throw new Failed(400, 'bad request')
    }
    if (!req.text?.trim() && !req.media) throw new Failed(400, 'empty')
    if (req.media && (!MEDIA.test(req.media.mime) || typeof req.media.data !== 'string')) throw new Failed(400, 'unsupported media')
    const today = madridDay()

    // Without a key (e.g. right after cloning) it answers with canned data instead of failing.
    const provider = env('AI_PROVIDER') ?? (env('GEMINI_API_KEY') ? 'gemini' : 'mock')
    // On a laptop with canned answers there's no one to check and nothing to spend.
    if (provider === 'mock' && !process.env.VERCEL) return Response.json(mockCapture(req, today))
    if (provider !== 'gemini' && provider !== 'deepseek') throw new Failed(503, `unknown AI_PROVIDER ${provider}`)
    // DeepSeek can't see photos or hear voice: those go to Gemini if there's a key for it.
    const useDeepseek = provider === 'deepseek' && !req.media
    if (provider === 'deepseek' && req.media && !env('GEMINI_API_KEY')) throw new Failed(400, 'text only')

    const { supa } = await allowedUser(request) // signed in and on the list
    const { data: count, error } = await supa.rpc('ai_hit') // supabase/setup.sql
    if (error) throw new Failed(503, 'daily counter missing: run supabase/setup.sql')
    if ((count as number) > Number(env('AI_DAILY_LIMIT') ?? 40)) throw new Failed(429, 'daily limit')

    const projects = (req.projects ?? []).filter((p) => typeof p === 'string').slice(0, 50)
    const system = buildCapturePrompt(today, projects)
    return Response.json(cleanCapture(await (useDeepseek ? deepseek(system, req) : gemini(system, req))))
  } catch (e) {
    return errorResponse(e, 'capture')
  }
}
