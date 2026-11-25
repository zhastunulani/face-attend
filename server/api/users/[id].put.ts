import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { ROLES, publicUserFields } from '~/server/utils/users'
import { audit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, ['admin'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })
  const body = await readBody(event)

  const data: Record<string, any> = {}
  if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 100)
  if (body?.role !== undefined) {
    if (!ROLES.includes(body.role)) throw createError({ statusCode: 400, statusMessage: 'Bad role', message: 'Рөл қате' })
    data.role = body.role
  }
  if (body?.departmentId !== undefined) data.departmentId = body.departmentId ? Number(body.departmentId) : null
  if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive)

  // Өзін-өзі бұғаттау / admin құқығынан айыру мүмкін емес — жүйе иесіз қалмауы керек
  if (id === admin.id && (data.isActive === false || (data.role && data.role !== 'admin'))) {
    throw createError({ statusCode: 400, statusMessage: 'Self lockout', message: 'Өз аккаунтыңызды бұғаттауға немесе рөлін түсіруге болмайды' })
  }
  if (!Object.keys(data).length) throw createError({ statusCode: 400, statusMessage: 'Nothing to update', message: 'Өзгеріс жоқ' })

  // Рөл/белсенділік өзгерсе — ескі сессиялар жарамсыз
  if (data.role !== undefined || data.isActive !== undefined || data.departmentId !== undefined) {
    data.tokenVersion = sql`${users.tokenVersion} + 1`
  }
  const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Қолданушы табылмады' })
  if (updated.role === 'head' && !updated.departmentId) {
    // Бөлімсіз басшы ештеңе көрмейді — бұл туралы ескертеміз, бірақ сақтаймыз
    setResponseHeader(event, 'X-Warning', 'head-without-department')
  }

  const { tokenVersion, ...logged } = data
  await audit(admin.id, 'user_updated', { userId: id, ...logged })
  return publicUserFields(updated)
})
