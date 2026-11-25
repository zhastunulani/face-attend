import { db } from '~/server/db'
import { schedules } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '~/server/utils/auth'
import { validateScheduleInput } from '~/server/utils/time'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID қате' })

  const body = await readBody(event)
  const updateData = validateScheduleInput(body ?? {}, true)
  if (!Object.keys(updateData).length) throw createError({ statusCode: 400, statusMessage: 'Nothing to update', message: 'Өзгеріс жоқ' })

  const result = await db.update(schedules).set(updateData).where(eq(schedules.id, id)).returning()
  if (!result.length) throw createError({ statusCode: 404, statusMessage: 'Кесте табылмады' })
  return result[0]
})
