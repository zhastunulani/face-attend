import bcryptjs from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { tempPassword } from '~/server/utils/users'
import { audit } from '~/server/utils/audit'

// Құпия сөзді қалпына келтіру: жаңа уақытша құпия сөз БІР РЕТ көрсетіледі, барлық сессиялар жабылады
export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, ['admin'])
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })

  const password = tempPassword()
  const [updated] = await db.update(users).set({
    password: await bcryptjs.hash(password, 10),
    mustChangePassword: true,
    tokenVersion: sql`${users.tokenVersion} + 1`,
  }).where(eq(users.id, id)).returning({ login: users.login })
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Қолданушы табылмады' })

  await audit(admin.id, 'user_password_reset', { userId: id })
  return { login: updated.login, tempPassword: password }
})
