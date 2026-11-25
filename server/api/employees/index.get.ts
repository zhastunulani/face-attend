import { db } from '~/server/db'
import { employees } from '~/server/db/schema'
import { eq, and, sql, type SQL } from 'drizzle-orm'
import { requireAuth, departmentScope } from '~/server/utils/auth'

// Бет дескрипторлары (биометрия) енді ешқашан клиентке берілмейді — тек hasFace белгісі.
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const activeOnly = query.active !== 'false'

  const conditions: SQL[] = []
  const scope = departmentScope(user)
  if (scope !== null) conditions.push(eq(employees.departmentId, scope))
  if (activeOnly) conditions.push(eq(employees.isActive, true))

  const rows = await db.select({
    id: employees.id,
    name: employees.name,
    departmentId: employees.departmentId,
    positionId: employees.positionId,
    photoPath: employees.photoPath,
    scheduleId: employees.scheduleId,
    salaryRate: employees.salaryRate,
    vacationDaysLeft: employees.vacationDaysLeft,
    isActive: employees.isActive,
    createdAt: employees.createdAt,
    hasFace: sql<boolean>`${employees.faceDescriptor} IS NOT NULL`,
    // Эталон саны: ескі жазбаларда 1 кадр — қайта тіркеу ұсынылады
    faceTemplates: sql<number>`CASE WHEN ${employees.faceDescriptor} IS NULL THEN 0 WHEN left(${employees.faceDescriptor}, 2) = '[[' THEN json_array_length(${employees.faceDescriptor}::json) ELSE 1 END`.mapWith(Number),
  }).from(employees).where(conditions.length ? and(...conditions) : undefined).orderBy(employees.name)

  // Жалақыны тек admin және head көреді
  if (user.role === 'manager') return rows.map(r => ({ ...r, salaryRate: null }))
  return rows
})
