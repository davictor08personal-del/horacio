// POST /api/ping: a test notification to the signed-in user's phones (button in Ajustes).
import { errorResponse, signedInUser } from './_auth.js'
import { sendPush, type PushSub } from './_push.js'

export async function POST(request: Request): Promise<Response> {
  try {
    const { supa } = await signedInUser(request)
    // RLS: this client only sees the user's own subscriptions.
    const { data: subs } = await supa.from('push_subscriptions').select('endpoint, p256dh, auth')
    if (!subs?.length) return Response.json({ sent: 0 })
    const gone = await sendPush(subs as PushSub[], { title: 'Cuadre', body: 'Así te avisaré de tus recordatorios, y a las 9:30 te diré cómo viene el día.', tag: 'ping' })
    if (gone.length) await supa.from('push_subscriptions').delete().in('endpoint', gone)
    return Response.json({ sent: subs.length - gone.length })
  } catch (e) {
    return errorResponse(e, 'ping')
  }
}
