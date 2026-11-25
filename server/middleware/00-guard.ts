import { ensureDb } from '~/server/db'

const MAX_BODY_BYTES = 4 * 1024 * 1024

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return

  // Сұраныс денесінің өлшемін шектеу (base64 фото ~ 1.5 МБ * 4/3)
  const length = Number(getRequestHeader(event, 'content-length') || 0)
  if (length > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Payload too large', message: 'Сұраныс тым үлкен' })
  }

  // Кестелер құрылып болғанша API сұраныстарын күттіру
  try {
    await ensureDb()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable', message: 'Дерекқор қолжетімсіз' })
  }

  setResponseHeader(event, 'Cache-Control', 'no-store')
})
