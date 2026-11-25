import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { holidays } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { isValidDate } from '~/server/utils/time'
import { audit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const date = getRouterParam(event, 'date')
  if (!isValidDate(date)) throw createError({ statusCode: 400, statusMessage: 'Bad date', message: 'Күн форматы: YYYY-MM-DD' })
  await db.delete(holidays).where(eq(holidays.date, date))
  await audit(user.id, 'holiday_removed', { date })
  return { success: true }
})
