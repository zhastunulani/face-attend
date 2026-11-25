import { db } from '~/server/db'
import { holidays } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'
import { isValidDate } from '~/server/utils/time'
import { audit } from '~/server/utils/audit'

// Мереке немесе ауыстырылған демалыс күнін қосу (мысалы, Құрбан айт, Үкімет қаулысы бойынша ауыстыру)
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const body = await readBody(event)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : ''
  if (!isValidDate(body?.date) || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Bad request', message: 'Күн (YYYY-MM-DD) мен атауы қажет' })
  }
  const [row] = await db.insert(holidays).values({ date: body.date, name })
    .onConflictDoUpdate({ target: holidays.date, set: { name } }).returning()
  await audit(user.id, 'holiday_saved', { date: body.date, name })
  return row
})
