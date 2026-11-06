// POST /api/tick: called every minute by Supabase (pg_cron, see supabase/cron.sql).
// Sends each reminder when its day and time arrive, and the morning summary at 9:30 — both in each user's
// own time zone (profiles.timezone).
//
// Why a cron outside Vercel: Vercel's free cron runs once a day; pg_cron (free in Supabase) runs every minute.
// It reads every user's tasks, so it uses the Supabase secret key (bypasses RLS). That key and CRON_SECRET
// only live in Vercel's environment variables, never in the app or in git.
import { timingSafeEqual } from 'node:crypto'
import { addDays, dueReminders, localDay, localMinutes, morningSummary, SUMMARY_FROM, SUMMARY_UNTIL, validTimeZone } from '../src/logic.js'
import type { Shift, Task } from '../src/types.js'
import { adminClient, env, errorResponse, Failed } from './_auth.js'
import { sendPush, type Message, type PushSub } from './_push.js'

type Row = Task & { user_id: string }
type Prof = { user_id: string; name: string | null; timezone: string; shifts: boolean }

function validSecret(header: string | null, secret: string) {
  const a = Buffer.from(header ?? '')
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<Response> {
  try {
    const secret = env('CRON_SECRET')
    if (!secret) throw new Failed(503, 'missing CRON_SECRET')
    if (!validSecret(request.headers.get('authorization'), secret)) throw new Failed(401, 'unauthorized')
    const admin = await adminClient()

    const { data: subs, error } = await admin.from('push_subscriptions').select('user_id, endpoint, p256dh, auth')
    if (error) throw new Failed(503, `push_subscriptions: ${error.message}`)
    if (!subs?.length) return Response.json({ sent: 0 })
    const users = [...new Set(subs.map((s) => s.user_id as string))]
    const { data: profs } = await admin.from('profiles').select('user_id, name, timezone, shifts').in('user_id', users)
    const prof = new Map((profs ?? []).map((p: Prof) => [p.user_id, { ...p, timezone: validTimeZone(p.timezone) ? p.timezone : 'Europe/Madrid' }]))
    const zoneOf = (id: string) => prof.get(id)?.timezone ?? 'Europe/Madrid'
    const now = new Date()
    const out: (Message & { user_id: string })[] = []

    // Reminders: only the candidates (with a time, not yet sent, around today), then each user's clock decides.
    const { data: candidates } = await admin.from('tasks').select('*').in('user_id', users).in('status', ['abierto', 'en_curso'])
      .not('due_time', 'is', null).is('notified_at', null).gte('due_date', addDays(localDay(now, 'UTC'), -2))
    const due = ((candidates ?? []) as Row[]).filter((t) => dueReminders([t], now, zoneOf(t.user_id)).length > 0)
    if (due.length) {
      // Marking them first (only if still unmarked) means two overlapping ticks can't both send one.
      const { data: claimed } = await admin.from('tasks').update({ notified_at: now.toISOString() })
        .in('id', due.map((t) => t.id)).is('notified_at', null).select('id, user_id, title')
      for (const t of claimed ?? []) out.push({ user_id: t.user_id, title: 'Recordatorio', body: t.title, tag: t.id })
    }

    // Morning summary: users for whom it's between 9:30 and noon now. push_daily takes one row per user and
    // (their) day, so each gets it once.
    const morning = users.filter((id) => { const m = localMinutes(now, zoneOf(id)); return m >= SUMMARY_FROM && m < SUMMARY_UNTIL })
    if (morning.length) {
      const { data: fresh } = await admin.from('push_daily')
        .upsert(morning.map((user_id) => ({ user_id, day: localDay(now, zoneOf(user_id)) })), { onConflict: 'user_id,day', ignoreDuplicates: true }).select('user_id, day')
      if (fresh?.length) {
        const ids = fresh.map((f) => f.user_id as string)
        const old = addDays(localDay(now, 'UTC'), -7)
        const [{ data: open }, { data: shifts }] = await Promise.all([
          admin.from('tasks').select('*').in('user_id', ids).in('status', ['abierto', 'en_curso', 'esperando']),
          admin.from('shifts').select('*').in('user_id', ids).in('day', [...new Set(fresh.map((f) => f.day as string))]),
          admin.from('push_daily').delete().lt('day', old),
          admin.from('ai_usage').delete().lt('day', old),
        ])
        for (const { user_id, day } of fresh) {
          const p = prof.get(user_id)
          const shift = (shifts ?? []).find((s) => s.user_id === user_id && s.day === day) as Shift | undefined
          out.push({ user_id, tag: 'summary', ...morningSummary(((open ?? []) as Row[]).filter((t) => t.user_id === user_id), shift, p?.name ?? null, !!p?.shifts) })
        }
      }
    }

    const gone = (await Promise.all(out.map(({ user_id, ...msg }) => sendPush(subs.filter((s) => s.user_id === user_id) as PushSub[], msg)))).flat()
    if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone)
    return Response.json({ sent: out.length })
  } catch (e) {
    return errorResponse(e, 'tick')
  }
}
