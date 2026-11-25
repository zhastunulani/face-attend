import { db } from '~/server/db'
import { attendance } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { buildManualRecord } from '~/server/utils/attendanceEdit'
import { isValidDate, localNow } from '~/server/utils/time'
import { audit } from '~/server/utils/audit'

// Белгі мүлдем жоқ күнге қолмен жазба қосу (мысалы, киоск істемей қалды)
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'head'])
  const body = await readBody(event)
  const employeeId = Number(body?.employeeId)
  if (!Number.isInteger(employeeId) || !isValidDate(body?.date)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad request', message: 'Қызметкер мен күн қажет' })
  }
  if (body.date > localNow().date) {
    throw createError({ statusCode: 400, statusMessage: 'Future date', message: 'Болашақ күнге белгі қоюға болмайды' })
  }

  const { values } = await buildManualRecord(user, employeeId, body.date, body)
  const inserted = await db.insert(attendance).values({ employeeId, date: body.date, ...values })
    .onConflictDoNothing().returning()
  if (!inserted.length) {
    throw createError({ statusCode: 409, statusMessage: 'Exists', message: 'Бұл күнге жазба бар — оны түзетіңіз' })
  }
  await audit(user.id, 'attendance_manual_created', { recordId: inserted[0].id, employeeId, date: body.date, note: values.note })
  return inserted[0]
})
