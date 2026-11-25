import { db } from '~/server/db'
import { leaves, employees } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, departmentScope } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const records = await db.select({
    id: leaves.id,
    employeeId: leaves.employeeId,
    employeeName: employees.name,
    departmentId: employees.departmentId,
    type: leaves.type,
    startDate: leaves.startDate,
    endDate: leaves.endDate,
    reason: leaves.reason,
    status: leaves.status,
    createdAt: leaves.createdAt,
  })
    .from(leaves)
    .innerJoin(employees, eq(leaves.employeeId, employees.id))

  const scope = departmentScope(user)
  if (scope !== null) return records.filter(r => r.departmentId === scope)

  return records
})
