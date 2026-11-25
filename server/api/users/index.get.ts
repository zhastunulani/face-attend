import { asc } from 'drizzle-orm'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { publicUserFields } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const rows = await db.select().from(users).orderBy(asc(users.id))
  return rows.map(publicUserFields)
})
