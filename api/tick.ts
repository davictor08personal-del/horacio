// POST /api/tick: called every minute by Supabase (pg_cron, see supabase/cron.sql).
// Sends each reminder when its day and time arrive, and the morning summary at 9:30 (Madrid).
//
// Why a cron outside Vercel: Vercel's free cron runs once a day; pg_cron (free in Supabase) runs every minute.
// It reads every user's tasks, so it uses the Supabase secret key (bypasses RLS). That key and CRON_SECRET
// only live in Vercel's environment variables, never in the app or in git.
import { createClient } from '@supabase/supabase-js'
import { dueReminders, madridDay, madridMinutes, morningSummary, OWNER, SUMMARY_FROM, SUMMARY_UNTIL } from '../src/logic.js'
import type { Shift, Task } from '../src/types.js'
import { env, errorResponse, Failed } from './_auth.js'
import { sendPush, type Message, type PushSub } from './_push.js'

type Row = Task & { user_id: string; notified_at: string | null }

export async function POST(request: Request): Promise<Response> {
  try {
    const secret = env('CRON_SECRET')
    if (!secret) throw new Failed(503, 'missing CRON_SECRET')
    if (request.headers.get('authorization') !== `Bearer ${secret}`) throw new Failed(401, 'unauthorized')
    const url = env('VITE_SUPABASE_URL')
    const key = env('SUPABASE_SECRET_KEY')
    if (!url || !key) throw new Failed(503, 'missing VITE_SUPABASE_URL/SUPABASE_SECRET_KEY')
    const admin = createClient(url, key, { auth: { persistSession: false } })

    const { data: subs, error } = await admin.from('push_subscriptions').select('user_id, endpoint, p256dh, auth')
    if (error) throw new Failed(503, `push_subscriptions: ${error.message}`)
    if (!subs?.length) return Response.json({ sent: 0 })
    const users = [...new Set(subs.map((s) => s.user_id as string))]
    const now = new Date()
    const out: (Message & { user_id: string })[] = []

    const { data: tasks } = await admin.from('tasks').select('*').in('user_id', users).in('status', ['abierto', 'en_curso', 'esperando'])
    const rows = (tasks ?? []) as Row[]

    // Reminders. Marking them first (only if still unmarked) means two overlapping ticks can't both send one.
    const due = dueReminders(rows.filter((t) => !t.notified_at), now)
    if (due.length) {
      const { data: claimed } = await admin.from('tasks').update({ notified_at: now.toISOString() })
        .in('id', due.map((t) => t.id)).is('notified_at', null).select('id, user_id, title')
      for (const t of claimed ?? []) out.push({ user_id: t.user_id, title: 'Le recuerdo', body: t.title, tag: t.id })
    }

    // Morning summary, once a day: push_daily only accepts one row per user and day.
    const minutes = madridMinutes(now)
    if (minutes >= SUMMARY_FROM && minutes < SUMMARY_UNTIL) {
      const today = madridDay(now)
      const { data: fresh } = await admin.from('push_daily')
        .upsert(users.map((user_id) => ({ user_id, day: today })), { onConflict: 'user_id,day', ignoreDuplicates: true }).select('user_id')
      if (fresh?.length) {
        const { data: shifts } = await admin.from('shifts').select('*').eq('day', today).in('user_id', fresh.map((f) => f.user_id))
        for (const { user_id } of fresh) {
          const shift = (shifts ?? []).find((s) => s.user_id === user_id) as Shift | undefined
          out.push({ user_id, tag: 'summary', ...morningSummary(rows.filter((t) => t.user_id === user_id), shift, OWNER) })
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
