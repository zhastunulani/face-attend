import { desc } from 'drizzle-orm'
import { db } from '~/server/db'
import { kiosks } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin'])
  return await db.select().from(kiosks).orderBy(desc(kiosks.id))
})
