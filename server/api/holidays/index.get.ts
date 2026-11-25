import { asc, like } from 'drizzle-orm'
import { db } from '~/server/db'
import { holidays } from '~/server/db/schema'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const year = Number(getQuery(event).year) || new Date().getUTCFullYear()
  return await db.select({ date: holidays.date, name: holidays.name }).from(holidays)
    .where(like(holidays.date, `${year}-%`)).orderBy(asc(holidays.date))
})
