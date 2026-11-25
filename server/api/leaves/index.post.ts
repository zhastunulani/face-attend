import { db } from '~/server/db'
import { leaves, employees } from '~/server/db/schema'
import { and, eq, inArray, lte, gte } from 'drizzle-orm'
import { requireRole, assertDepartmentAccess } from '~/server/utils/auth'
import { isValidDate } from '~/server/utils/time'
import { audit } from '~/server/utils/audit'

const LEAVE_TYPES = ['vacation', 'sick', 'maternity', 'other']

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'head', 'manager'])
  const body = await readBody(event)
  const employeeId = Number(body?.employeeId)
  const { type, startDate, endDate } = body ?? {}

  if (!Number.isInteger(employeeId) || !LEAVE_TYPES.includes(type) || !isValidDate(startDate) || !isValidDate(endDate)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad request', message: 'Барлық өрістерді дұрыс толтырыңыз' })
  }
  if (startDate > endDate) {
    throw createError({ statusCode: 400, statusMessage: 'Bad dates', message: 'Басталу күні аяқталу күнінен кейін болмауы керек' })
  }
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1
  if (days > 366) throw createError({ statusCode: 400, statusMessage: 'Too long', message: 'Мерзім тым ұзақ' })

  const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId))
  if (!emp || !emp.isActive) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Қызметкер табылмады' })
  assertDepartmentAccess(user, emp.departmentId)

  if (type === 'vacation' && days > emp.vacationDaysLeft) {
    throw createError({ statusCode: 400, statusMessage: 'Not enough days', message: `Демалыс күндері жеткіліксіз (қалғаны: ${emp.vacationDaysLeft})` })
  }

  // Бір қызметкердің мерзімдері қиылыспауы керек
  const [overlap] = await db.select({ id: leaves.id }).from(leaves).where(and(
    eq(leaves.employeeId, employeeId),
    inArray(leaves.status, ['pending', 'approved']),
    lte(leaves.startDate, endDate),
    gte(leaves.endDate, startDate),
  ))
  if (overlap) throw createError({ statusCode: 409, statusMessage: 'Overlap', message: 'Бұл мерзімде басқа сұраныс бар' })

  const [created] = await db.insert(leaves).values({
    employeeId,
    type,
    startDate,
    endDate,
    reason: typeof body.reason === 'string' ? body.reason.slice(0, 1000) : null,
  }).returning()

  await audit(user.id, 'leave_requested', { leaveId: created.id, employeeId, type, days })
  return created
})
