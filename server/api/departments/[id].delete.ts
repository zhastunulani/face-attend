import { db } from '~/server/db'
import { departments } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'ID қате' })

  try {
    await db.delete(departments).where(eq(departments.id, id))
  } catch (e: any) {
    // 23503 = foreign key violation: қызметкерлер/лауазымдар әлі осы жазбаға сілтейді
    if ((e?.code ?? e?.cause?.code) === '23503') {
      throw createError({ statusCode: 409, statusMessage: 'In use', message: 'Жазба қолданыста — алдымен байланысты деректерді ауыстырыңыз' })
    }
    throw e
  }
  return { success: true }
})
