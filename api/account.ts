// POST /api/account { "action": "delete" }: deletes the signed-in user's account and everything in it.
// Every table references auth.users with «on delete cascade» (supabase/setup.sql), so deleting the user
// deletes their tasks, notes, projects, daily tasks, profile, notification subscriptions… in one go.
// Needs the secret key (only the admin API can delete users), so it runs here, never in the app.
import { adminClient, errorResponse, Failed, signedInUser } from './_auth.js'

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}))
    if ((body as { action?: unknown }).action !== 'delete') throw new Failed(400, 'bad request')
    const { id } = await signedInUser(request)
    const admin = await adminClient()
    // Files aren't covered by «on delete cascade»: remove the user's note pictures first (best effort, 1000 at a time).
    for (let i = 0; i < 20; i++) {
      const { data: files } = await admin.storage.from('note-images').list(id, { limit: 1000 })
      if (!files?.length) break
      await admin.storage.from('note-images').remove(files.map((f) => `${id}/${f.name}`))
    }
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw new Failed(502, `delete user: ${error.message}`)
    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse(e, 'account')
  }
}
