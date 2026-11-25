import { db } from '~/server/db'
import { attendance, employees } from '~/server/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, departmentScope } from '~/server/utils/auth'
import { localNow } from '~/server/utils/time'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const today = localNow().date
  const scope = departmentScope(user)

  const records = await db.select({
    id: attendance.id,
    employeeId: attendance.employeeId,
    employeeName: employees.name,
    departmentId: employees.departmentId,
    checkIn: attendance.checkIn,
    checkOut: attendance.checkOut,
    isLate: attendance.isLate,
    lateMinutes: attendance.lateMinutes,
    overtimeMinutes: attendance.overtimeMinutes,
    status: attendance.status,
  })
    .from(attendance)
    .innerJoin(employees, eq(attendance.employeeId, employees.id))
    .where(eq(attendance.date, today))

  // Filter by department for head role
  const filtered = scope !== null ? records.filter(r => r.departmentId === scope) : records

  // Get all active employees for absent calculation
  const allEmployees = await db.select({ id: employees.id, name: employees.name, departmentId: employees.departmentId })
    .from(employees).where(eq(employees.isActive, true))

  const presentIds = new Set(filtered.filter(r => r.checkIn).map(r => r.employeeId))
  const relevantEmployees = scope !== null ? allEmployees.filter(e => e.departmentId === scope) : allEmployees
  const absent = relevantEmployees.filter(e => !presentIds.has(e.id))

  return {
    date: today,
    present: filtered,
    absent,
    stats: {
      total: relevantEmployees.length,
      presentCount: presentIds.size,
      absentCount: absent.length,
      lateCount: filtered.filter(r => r.isLate).length,
    },
  }
})
