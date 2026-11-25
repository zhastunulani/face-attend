import { and, eq, like, type SQL } from 'drizzle-orm'
import { db } from '~/server/db'
import { attendance, employees, departments } from '~/server/db/schema'

export function parsePeriod(year: unknown, month: unknown) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
    throw createError({ statusCode: 400, statusMessage: 'Bad period', message: 'Жыл мен ай қате' })
  }
  return { year: y, month: m, prefix: `${y}-${String(m).padStart(2, '0')}` }
}

/** Айдағы барлық келу жазбалары (head үшін тек өз бөлімі) */
export async function monthAttendance(prefix: string, scope: number | null) {
  const conditions: SQL[] = [like(attendance.date, `${prefix}-%`)]
  if (scope !== null) conditions.push(eq(employees.departmentId, scope))
  return await db.select({
    id: attendance.id,
    employeeId: attendance.employeeId,
    employeeName: employees.name,
    departmentId: employees.departmentId,
    departmentName: departments.name,
    date: attendance.date,
    checkIn: attendance.checkIn,
    checkOut: attendance.checkOut,
    isLate: attendance.isLate,
    lateMinutes: attendance.lateMinutes,
    overtimeMinutes: attendance.overtimeMinutes,
    status: attendance.status,
  })
    .from(attendance)
    .innerJoin(employees, eq(attendance.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(attendance.date)
}
