import { db } from '~/server/db'
import { attendance, employees } from '~/server/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, departmentScope } from '~/server/utils/auth'
import { isValidDate } from '~/server/utils/time'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const scope = departmentScope(user)
  const date = getRouterParam(event, 'date')
  if (!isValidDate(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Күн форматы: YYYY-MM-DD' })
  }

  return await db.select({
    id: attendance.id,
    employeeId: attendance.employeeId,
    employeeName: employees.name,
    checkIn: attendance.checkIn,
    checkOut: attendance.checkOut,
    isLate: attendance.isLate,
    lateMinutes: attendance.lateMinutes,
    overtimeMinutes: attendance.overtimeMinutes,
    status: attendance.status,
  })
    .from(attendance)
    .innerJoin(employees, eq(attendance.employeeId, employees.id))
    .where(scope !== null ? and(eq(attendance.date, date), eq(employees.departmentId, scope)) : eq(attendance.date, date))
})
