import { db } from '~/server/db'
import { kiosks } from '~/server/db/schema'
import { requireRole, signKioskToken, cookieOptions, KIOSK_COOKIE } from '~/server/utils/auth'
import { audit } from '~/server/utils/audit'

// Admin/head осы құрылғыны (планшет, ноутбук) киоск ретінде тіркейді.
// Құрылғы 180 күнге httpOnly cookie алады; сканерлеу тек тіркелген киосктен мүмкін.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'head'])
  const body = await readBody(event)
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'Киоск'

  const mode = ['auto', 'in', 'out'].includes(body?.mode) ? body.mode : 'auto'
  const [kiosk] = await db.insert(kiosks).values({ name, mode, createdBy: user.id }).returning()
  setCookie(event, KIOSK_COOKIE, signKioskToken(kiosk.id), cookieOptions(60 * 60 * 24 * 180))
  await audit(user.id, 'kiosk_activated', { kioskId: kiosk.id, name, mode })

  return { id: kiosk.id, name: kiosk.name, mode: kiosk.mode }
})
