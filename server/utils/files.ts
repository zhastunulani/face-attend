import { pool } from '~/server/db'

// Фотолар базада сақталады: Render (free) дискі әр қайта іске қосылғанда тазаланады,
// ал production-да public/ бумасына жазылған файлдар мүлдем қызмет етілмейді.

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024

export function decodeImageDataUrl(dataUrl: unknown): { mime: string; data: Buffer } {
  if (typeof dataUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Bad image', message: 'Фото форматы қате' })
  }
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!m) throw createError({ statusCode: 400, statusMessage: 'Bad image', message: 'Тек JPEG/PNG/WebP фото қабылданады' })
  const data = Buffer.from(m[2], 'base64')
  if (data.length > MAX_IMAGE_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Image too large', message: 'Фото тым үлкен (макс. 1.5 МБ)' })
  }
  // Магиялық байттарды тексеру — тек нақты сурет файлдары
  const isJpeg = data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF
  const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
  const isWebp = data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP'
  const mime = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : null
  if (!mime) throw createError({ statusCode: 400, statusMessage: 'Bad image', message: 'Файл сурет емес' })
  return { mime, data }
}

/** Суретті сақтап, оның URL-ін қайтарады (/api/files/<id>) */
export async function saveImage(dataUrl: unknown, kind: 'employee' | 'checkin'): Promise<string> {
  const { mime, data } = decodeImageDataUrl(dataUrl)
  const { rows } = await pool.query('INSERT INTO files (kind, mime, data) VALUES ($1, $2, $3) RETURNING id', [kind, mime, data])
  return `/api/files/${rows[0].id}`
}
