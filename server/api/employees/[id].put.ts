import { db } from '~/server/db'
import { employees } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole, assertDepartmentAccess } from '~/server/utils/auth'
import { parseEmployeeInput } from '~/server/utils/employeeInput'
import { saveImage } from '~/server/utils/files'
import { invalidateFaceCache } from '~/server/utils/face'
import { audit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'head'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })

  const [existing] = await db.select().from(employees).where(eq(employees.id, id))
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Қызметкер табылмады' })
  assertDepartmentAccess(user, existing.departmentId)

  const body = await readBody(event)
  const data = await parseEmployeeInput(body ?? {}, user, id)
  if (body?.photo) data.photoPath = await saveImage(body.photo, 'employee')

  if (!Object.keys(data).length) {
    const { faceDescriptor, ...rest } = existing
    return { ...rest, hasFace: !!faceDescriptor }
  }

  const [updated] = await db.update(employees).set(data).where(eq(employees.id, id)).returning()
  invalidateFaceCache()
  await audit(user.id, 'employee_updated', { employeeId: id, fields: Object.keys(data).filter(k => k !== 'faceDescriptor').concat('faceDescriptor' in data ? ['face'] : []) })

  const { faceDescriptor, ...rest } = updated
  return { ...rest, hasFace: !!faceDescriptor }
})
