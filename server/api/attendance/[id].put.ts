import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { attendance } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { buildManualRecord } from '~/server/utils/attendanceEdit'
import { audit } from '~/server/utils/audit'

// Белгіні түзету: мысалы, қызметкер кетуді белгілемей кетті
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'head'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })

  const [existing] = await db.select().from(attendance).where(eq(attendance.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Жазба табылмады' })

  const body = await readBody(event)
  const { values } = await buildManualRecord(user, existing.employeeId, existing.date, body)
  const [updated] = await db.update(attendance).set(values).where(eq(attendance.id, id)).returning()

  await audit(user.id, 'attendance_corrected', {
    recordId: id,
    employeeId: existing.employeeId,
    date: existing.date,
    before: { checkIn: existing.checkIn, checkOut: existing.checkOut },
    after: { checkIn: values.checkIn, checkOut: values.checkOut },
    note: values.note,
  })
  return updated
})
