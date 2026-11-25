import bcryptjs from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { ROLES, tempPassword, publicUserFields } from '~/server/utils/users'
import { audit } from '~/server/utils/audit'

// Жаңа қолданушы (бөлім басшысы, менеджер). Уақытша құпия сөз жауапта БІР РЕТ қайтарылады.
export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, ['admin'])
  const body = await readBody(event)
  const login = typeof body?.login === 'string' ? body.login.trim().toLowerCase() : ''
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : ''
  const role = body?.role
  const departmentId = body?.departmentId ? Number(body.departmentId) : null

  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad login', message: 'Логин: 3–32 таңба (a-z, 0-9, . _ -)' })
  }
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Bad name', message: 'Аты қажет' })
  if (!ROLES.includes(role)) throw createError({ statusCode: 400, statusMessage: 'Bad role', message: 'Рөл қате' })
  if (role === 'head' && !departmentId) {
    throw createError({ statusCode: 400, statusMessage: 'Department required', message: 'Бөлім басшысына бөлім таңдаңыз' })
  }
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.login, login))
  if (exists) throw createError({ statusCode: 409, statusMessage: 'Exists', message: 'Бұл логин бос емес' })

  const password = tempPassword()
  const [created] = await db.insert(users).values({
    login,
    name,
    role,
    departmentId,
    password: await bcryptjs.hash(password, 10),
    mustChangePassword: true,
  }).returning()

  await audit(admin.id, 'user_created', { userId: created.id, login, role })
  return { user: publicUserFields(created), tempPassword: password }
})
