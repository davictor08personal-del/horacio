// POST /api/ping: a test notification to the signed-in user's phones (button in Ajustes).
import { allowedUser, errorResponse } from './_auth.js'
import { sendPush, type PushSub } from './_push.js'

export async function POST(request: Request): Promise<Response> {
  try {
    const { supa } = await allowedUser(request)
    // RLS: this client only sees the user's own subscriptions.
    const { data: subs } = await supa.from('push_subscriptions').select('endpoint, p256dh, auth')
    if (!subs?.length) return Response.json({ sent: 0 })
    const gone = await sendPush(subs as PushSub[], { title: 'Horacio', body: 'Así le avisaré de sus recordatorios, y a las 9:30 le diré cómo viene el día.', tag: 'ping' })
    if (gone.length) await supa.from('push_subscriptions').delete().in('endpoint', gone)
    return Response.json({ sent: subs.length - gone.length })
  } catch (e) {
    return errorResponse(e, 'ping')
  }
}
