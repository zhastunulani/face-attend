import { db } from '~/server/db'
import { schedules } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { validateScheduleInput } from '~/server/utils/time'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const body = await readBody(event)

  const result = await db.insert(schedules).values(validateScheduleInput(body ?? {}, false) as unknown as typeof schedules.$inferInsert).returning()

  return result[0]
})
