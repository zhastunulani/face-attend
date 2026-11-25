import bcryptjs from 'bcryptjs'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { signToken, cookieOptions, AUTH_COOKIE } from '~/server/utils/auth'
import { audit, hitRateLimit, resetRateLimit, clientIp } from '~/server/utils/audit'

// Логин жоқ болса да bcrypt салыстыру жасаймыз — жауап уақыты бойынша логинді анықтауға болмайды
const DUMMY_HASH = bcryptjs.hashSync('dummy-password-for-timing', 10)

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const login = typeof body?.login === 'string' ? body.login.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!login || !password || password.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Bad request', message: 'Логин мен пароль қажет' })
  }

  const ip = clientIp(event)
  const key = `login:${ip}:${login.toLowerCase()}`
  if (hitRateLimit(key, 5, 15 * 60_000) || hitRateLimit(`login-ip:${ip}`, 30, 15 * 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts', message: 'Тым көп әрекет. 15 минуттан кейін қайталаңыз' })
  }

  const [user] = await db.select().from(users).where(eq(users.login, login))
  const valid = await bcryptjs.compare(password, user?.password ?? DUMMY_HASH)

  if (!user || !user.isActive || !valid) {
    await audit(user?.id ?? null, 'login_failed', { login, ip })
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials', message: 'Логин немесе пароль қате' })
  }

  resetRateLimit(key)
  setCookie(event, AUTH_COOKIE, signToken({ id: user.id, tv: user.tokenVersion }), cookieOptions(60 * 60 * 12))
  await audit(user.id, 'login', { ip })

  return {
    user: {
      id: user.id,
      login: user.login,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      mustChangePassword: user.mustChangePassword,
    },
  }
})
