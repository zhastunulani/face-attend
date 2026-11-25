import { db } from '~/server/db'
import { salarySettings } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const body = await readBody(event)

  const [existing] = await db.select().from(salarySettings)
  if (!existing) throw createError({ statusCode: 500, statusMessage: 'Баптаулар табылмады' })

  const num = (v: unknown, fallback: number, min: number, max: number, int = false) => {
    if (v === undefined || v === null || v === '') return fallback
    const n = Number(v)
    if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
      throw createError({ statusCode: 400, statusMessage: 'Bad value', message: `Мән ${min}–${max} аралығында болуы керек` })
    }
    return n
  }

  const result = await db.update(salarySettings).set({
    overtimeCoefficient: num(body?.overtimeCoefficient, existing.overtimeCoefficient, 1, 5),
    weekendCoefficient: num(body?.weekendCoefficient, existing.weekendCoefficient, 1, 5),
    standardHoursPerDay: num(body?.standardHoursPerDay, existing.standardHoursPerDay, 1, 24, true),
    updatedAt: new Date().toISOString(),
  }).where(eq(salarySettings.id, existing.id)).returning()

  return result[0]
})
