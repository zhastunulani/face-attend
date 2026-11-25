import { pool } from '~/server/db'
import { requireAuth } from '~/server/utils/auth'

// Фотолар тек жүйеге кірген қолданушыларға көрінеді
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })

  const { rows } = await pool.query('SELECT mime, data FROM files WHERE id = $1', [id])
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Файл табылмады' })

  setResponseHeaders(event, {
    'Content-Type': rows[0].mime,
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  })
  return rows[0].data as Buffer
})
