import type { AuthUser } from '~/server/utils/auth'
import { departmentScope } from '~/server/utils/auth'
import { parseTemplates, findDuplicateFace, checkEnrollmentConsistency, MAX_TEMPLATES } from '~/server/utils/face'

const optionalId = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '' || v === 0) return null
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw createError({ statusCode: 400, statusMessage: 'Bad id', message: 'ID қате' })
  return n
}

/** Қызметкер формасының өрістерін тексеріп, рұқсаттарды қолданады */
export async function parseEmployeeInput(body: any, user: AuthUser, existingId?: number) {
  const data: Record<string, any> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 200) throw createError({ statusCode: 400, statusMessage: 'Bad name', message: 'Аты-жөні қажет' })
    data.name = name
  }
  if (body.departmentId !== undefined) data.departmentId = optionalId(body.departmentId)
  if (body.positionId !== undefined) data.positionId = optionalId(body.positionId)
  if (body.scheduleId !== undefined) data.scheduleId = optionalId(body.scheduleId)

  // Head тек өз бөліміне қосады/ауыстырады
  const scope = departmentScope(user)
  if (scope !== null) {
    if (data.departmentId !== undefined && data.departmentId !== scope) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Тек өз бөліміңізге қызметкер қоса аласыз' })
    }
    if (!existingId) data.departmentId = scope
  }

  if (body.salaryRate !== undefined) {
    // Жалақыны тек admin өзгертеді
    if (user.role === 'admin') {
      const rate = Number(body.salaryRate || 0)
      if (!Number.isFinite(rate) || rate < 0 || rate > 1e9) {
        throw createError({ statusCode: 400, statusMessage: 'Bad salary', message: 'Жалақы мөлшері қате' })
      }
      data.salaryRate = rate
    }
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

  // Бет эталондары: faceDescriptors (1–5 кадр, жаңа) немесе faceDescriptor (бір кадр, ескі клиенттер)
  const rawFace = body.faceDescriptors ?? body.faceDescriptor
  if (rawFace !== undefined && rawFace !== null && rawFace !== '') {
    const templates = parseTemplates(rawFace)
    if (!templates) {
      throw createError({ statusCode: 400, statusMessage: 'Bad descriptor', message: `Face descriptor форматы қате (1–${MAX_TEMPLATES} × 128 сан)` })
    }
    if (!checkEnrollmentConsistency(templates)) {
      throw createError({ statusCode: 400, statusMessage: 'Inconsistent enrollment', message: 'Кадрлар бір-біріне ұқсамайды. Камераға тура қарап, қозғалмай қайта түсіріңіз' })
    }
    const dup = await findDuplicateFace(templates, existingId)
    if (dup) {
      throw createError({ statusCode: 409, statusMessage: 'Duplicate face', message: `Бұл бет "${dup.name}" қызметкеріне тіркелген` })
    }
    data.faceDescriptor = JSON.stringify(templates)
  } else if (body.faceDescriptor === null || body.faceDescriptors === null) {
    data.faceDescriptor = null
  }

  return data
}
