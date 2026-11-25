import { db } from '~/server/db'
import { payroll, employees } from '~/server/db/schema'
import { eq, and, type SQL } from 'drizzle-orm'
import { requireRole, departmentScope } from '~/server/utils/auth'
import { parsePeriod } from '~/server/utils/period'

// Жалақы — құпия дерек: manager көрмейді, head тек өз бөлімін көреді
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'head'])
  const query = getQuery(event)
  const { year, month } = parsePeriod(query.year, query.month)

  const conditions: SQL[] = [eq(payroll.month, month), eq(payroll.year, year)]
  const scope = departmentScope(user)
  if (scope !== null) conditions.push(eq(employees.departmentId, scope))

  return await db.select({
    id: payroll.id,
    employeeId: payroll.employeeId,
    employeeName: employees.name,
    departmentId: employees.departmentId,
    month: payroll.month,
    year: payroll.year,
    workDays: payroll.workDays,
    plannedDays: payroll.plannedDays,
    workHours: payroll.workHours,
    regularHours: payroll.regularHours,
    overtimeHours: payroll.overtimeHours,
    weekendHours: payroll.weekendHours,
    baseAmount: payroll.baseAmount,
    overtimeAmount: payroll.overtimeAmount,
    weekendAmount: payroll.weekendAmount,
    deductions: payroll.deductions,
    totalAmount: payroll.totalAmount,
  })
    .from(payroll)
    .innerJoin(employees, eq(payroll.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(employees.name)
})
