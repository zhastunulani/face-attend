import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { attendance } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { audit } from '~/server/utils/audit'

// Қате жазбаны жою (тек admin); жойылған жазбаның мазмұны журналда қалады
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })
  const body = await readBody(event).catch(() => ({}))
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : ''
  if (note.length < 3) throw createError({ statusCode: 400, statusMessage: 'Bad request', message: 'Жою себебін жазыңыз' })

  const [deleted] = await db.delete(attendance).where(eq(attendance.id, id)).returning()
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Жазба табылмады' })
  await audit(user.id, 'attendance_deleted', {
    recordId: id, employeeId: deleted.employeeId, date: deleted.date, checkIn: deleted.checkIn, checkOut: deleted.checkOut, note,
  })
  return { success: true }
})
