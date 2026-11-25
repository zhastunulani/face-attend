import { db } from '~/server/db'
import { employees } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { parseEmployeeInput } from '~/server/utils/employeeInput'
import { saveImage } from '~/server/utils/files'
import { invalidateFaceCache } from '~/server/utils/face'
import { audit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'head'])
  const body = await readBody(event)
  if (body?.name === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Bad name', message: 'Аты-жөні қажет' })
  }

  const data = await parseEmployeeInput(body, user)
  if (body.photo) data.photoPath = await saveImage(body.photo, 'employee')

  const [created] = await db.insert(employees).values(data as typeof employees.$inferInsert).returning()
  invalidateFaceCache()
  await audit(user.id, 'employee_created', { employeeId: created.id, hasFace: !!created.faceDescriptor })

  const { faceDescriptor, ...rest } = created
  return { ...rest, hasFace: !!faceDescriptor }
})
