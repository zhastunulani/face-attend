import bcryptjs from 'bcryptjs'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, signToken, cookieOptions, AUTH_COOKIE } from '~/server/utils/auth'
import { audit, hitRateLimit } from '~/server/utils/audit'

const WEAK = ['admin123', 'head123', 'manager123', 'password', '12345678', 'qwerty123']

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { oldPassword, newPassword } = body ?? {}

  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || !oldPassword || !newPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Bad request', message: 'Ескі және жаңа пароль қажет' })
  }
  if (newPassword.length < 8 || newPassword.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Weak password', message: 'Жаңа пароль 8–200 таңба болуы керек' })
  }
  if (WEAK.includes(newPassword.toLowerCase()) || newPassword === oldPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Weak password', message: 'Бұл парольді қолдануға болмайды' })
  }
  if (hitRateLimit(`chpw:${user.id}`, 5, 15 * 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts', message: 'Тым көп әрекет' })
  }

  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id))
  if (!dbUser || !(await bcryptjs.compare(oldPassword, dbUser.password))) {
    throw createError({ statusCode: 401, statusMessage: 'Wrong password', message: 'Ескі пароль қате' })
  }

  const hash = await bcryptjs.hash(newPassword, 10)
  const tokenVersion = dbUser.tokenVersion + 1
  // tokenVersion өседі -> басқа құрылғылардағы ескі сессиялар жарамсыз болады
  await db.update(users).set({ password: hash, tokenVersion, mustChangePassword: false }).where(eq(users.id, user.id))
  setCookie(event, AUTH_COOKIE, signToken({ id: user.id, tv: tokenVersion }), cookieOptions(60 * 60 * 12))
  await audit(user.id, 'password_changed')

  return { success: true }
})
