import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { kiosks } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { audit } from '~/server/utils/audit'

// Киоск атауы мен режимін өзгерту: 'auto' (бір есік), 'in' (кіреберіс), 'out' (шығу)
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })
  const body = await readBody(event)

  const data: { mode?: string; name?: string } = {}
  if (body?.mode !== undefined) {
    if (!['auto', 'in', 'out'].includes(body.mode)) throw createError({ statusCode: 400, statusMessage: 'Bad mode', message: 'Режим: auto, in немесе out' })
    data.mode = body.mode
  }
  if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 80)
  if (!Object.keys(data).length) throw createError({ statusCode: 400, statusMessage: 'Nothing to update', message: 'Өзгеріс жоқ' })

  const [updated] = await db.update(kiosks).set(data).where(eq(kiosks.id, id)).returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Киоск табылмады' })
  await audit(user.id, 'kiosk_updated', { kioskId: id, ...data })
  return updated
})
