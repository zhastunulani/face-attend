import { db } from '~/server/db'
import { leaves, employees } from '~/server/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireRole, assertDepartmentAccess } from '~/server/utils/auth'
import { audit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'head'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })

  const body = await readBody(event)
  if (!['approved', 'rejected'].includes(body?.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad status', message: 'Статус: approved немесе rejected' })
  }

  const result = await db.transaction(async (tx) => {
    // FOR UPDATE: бір сұранысты қатар екі рет бекітуге болмайды
    const [leave] = await tx.select().from(leaves).where(eq(leaves.id, id)).for('update')
    if (!leave) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Сұраныс табылмады' })
    if (leave.status !== 'pending') {
      throw createError({ statusCode: 409, statusMessage: 'Already processed', message: 'Сұраныс бұрын қаралған' })
    }

    const [emp] = await tx.select().from(employees).where(eq(employees.id, leave.employeeId))
    assertDepartmentAccess(user, emp?.departmentId)

    if (body.status === 'approved' && leave.type === 'vacation' && emp) {
      // ҚР Еңбек кодексі: жыл сайынғы демалыс күнтізбелік күндермен есептеледі
      const days = Math.round((Date.parse(leave.endDate) - Date.parse(leave.startDate)) / 86_400_000) + 1
      const updated = await tx.update(employees)
        .set({ vacationDaysLeft: sql`${employees.vacationDaysLeft} - ${days}` })
        .where(and(eq(employees.id, emp.id), sql`${employees.vacationDaysLeft} >= ${days}`))
        .returning({ id: employees.id })
      if (!updated.length) {
        throw createError({ statusCode: 400, statusMessage: 'Not enough days', message: `Демалыс күндері жеткіліксіз (қалғаны: ${emp.vacationDaysLeft})` })
      }
    }

    const [saved] = await tx.update(leaves).set({ status: body.status, approvedBy: user.id }).where(eq(leaves.id, id)).returning()
    return saved
  })

  await audit(user.id, `leave_${body.status}`, { leaveId: id })
  return result
})
