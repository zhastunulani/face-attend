import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { users, kiosks } from '~/server/db/schema'

export type Role = 'admin' | 'head' | 'manager'

interface JwtPayload {
  id: number
  tv: number // token version: құпия сөз ауысқанда ескі токендер жарамсыз
}

interface KioskPayload {
  kind: 'kiosk'
  kid: number
}

export interface AuthUser {
  id: number
  login: string
  name: string
  role: Role
  departmentId: number | null
  mustChangePassword: boolean
}

const DEV_FALLBACK_SECRET = randomBytes(32).toString('hex')
let warned = false

function getSecret(): string {
  const secret = process.env.JWT_SECRET || useRuntimeConfig().jwtSecret
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 500, statusMessage: 'Server misconfigured: JWT_SECRET (>= 32 chars) is required' })
  }
  if (!warned) {
    console.warn('[face-attend] JWT_SECRET is not set - using a random per-process secret (sessions reset on restart)')
    warned = true
  }
  return DEV_FALLBACK_SECRET
}

export const AUTH_COOKIE = 'auth_token'
export const KIOSK_COOKIE = 'kiosk_token'

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '12h', algorithm: 'HS256' })
}

export function signKioskToken(kioskId: number): string {
  return jwt.sign({ kind: 'kiosk', kid: kioskId } satisfies KioskPayload, getSecret(), { expiresIn: '180d', algorithm: 'HS256' })
}

function verify<T>(token: string): T | null {
  try {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as T
  } catch {
    return null
  }
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: maxAgeSeconds,
    path: '/',
  }
}

/** Токенді тексереді және қолданушыны базадан қайта оқиды (рөл/белсенділік әрқашан өзекті) */
export async function getAuthUser(event: H3Event): Promise<AuthUser | null> {
  if (event.context.authUser !== undefined) return event.context.authUser
  let result: AuthUser | null = null
  const token = getCookie(event, AUTH_COOKIE)
  const payload = token ? verify<JwtPayload>(token) : null
  if (payload && typeof payload.id === 'number') {
    const [u] = await db.select().from(users).where(eq(users.id, payload.id))
    if (u && u.isActive && u.tokenVersion === payload.tv) {
      result = {
        id: u.id,
        login: u.login,
        name: u.name,
        role: u.role as Role,
        departmentId: u.departmentId,
        mustChangePassword: u.mustChangePassword,
      }
    }
  }
  event.context.authUser = result
  return result
}

const PASSWORD_CHANGE_ALLOWED = ['/api/auth/me', '/api/auth/logout', '/api/auth/change-password']

export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Авторизация қажет' })
  }
  if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.includes(event.path.split('?')[0])) {
    throw createError({ statusCode: 403, statusMessage: 'Password change required', message: 'Алдымен құпия сөзді ауыстырыңыз' })
  }
  return user
}

export async function requireRole(event: H3Event, roles: Role[]): Promise<AuthUser> {
  const user = await requireAuth(event)
  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Рұқсат жоқ' })
  }
  return user
}

/** Белсенді киоск құрылғысы (cookie арқылы) */
export async function getKiosk(event: H3Event) {
  const token = getCookie(event, KIOSK_COOKIE)
  const payload = token ? verify<KioskPayload>(token) : null
  if (!payload || payload.kind !== 'kiosk') return null
  const [k] = await db.select().from(kiosks).where(eq(kiosks.id, payload.kid))
  if (!k || k.isRevoked) return null
  return k
}

/**
 * Head рөлі тек өз бөлімімен жұмыс істейді.
 * Қайтарады: null = шектеу жоқ (admin/manager), number = рұқсат етілген бөлім.
 * Бөлімі жоқ head ешнәрсе көрмейді (-1).
 */
export function departmentScope(user: AuthUser): number | null {
  if (user.role !== 'head') return null
  return user.departmentId ?? -1
}

export function assertDepartmentAccess(user: AuthUser, departmentId: number | null | undefined) {
  const scope = departmentScope(user)
  if (scope !== null && departmentId !== scope) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Бұл бөлімге рұқсат жоқ' })
  }
}
