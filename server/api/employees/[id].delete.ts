import { db } from '~/server/db'
import { employees } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '~/server/utils/auth'
import { invalidateFaceCache } from '~/server/utils/face'
import { audit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })

  // Soft delete; биометрияны сақтамаймыз — жұмыстан шыққан адамның бет дескрипторы өшіріледі
  await db.update(employees).set({ isActive: false, faceDescriptor: null }).where(eq(employees.id, id))
  invalidateFaceCache()
  await audit(user.id, 'employee_deactivated', { employeeId: id })
  return { success: true }
})
