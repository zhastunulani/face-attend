import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { kiosks } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { audit } from '~/server/utils/audit'

// Киоскіні бұғаттау (мысалы, планшет жоғалса)
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })
  const result = await db.update(kiosks).set({ isRevoked: true }).where(eq(kiosks.id, id)).returning()
  if (!result.length) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Киоск табылмады' })
  await audit(user.id, 'kiosk_revoked', { kioskId: id })
  return { success: true }
})
