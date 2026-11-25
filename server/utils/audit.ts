import { db } from '~/server/db'
import { auditLog } from '~/server/db/schema'

/** Маңызды әрекеттерді audit_log кестесіне жазады; қате болса негізгі сұранысты бұзбайды */
export async function audit(userId: number | null, action: string, details?: Record<string, unknown>) {
  try {
    await db.insert(auditLog).values({
      userId,
      action,
      details: details ? JSON.stringify(details) : null,
    })
  } catch (e) {
    console.error('audit log failed:', e)
  }
}

// ==================== Қарапайым rate limit (бір процесс ішінде) ====================

const buckets = new Map<string, { count: number; resetAt: number }>()

/** `limit` әрекетке дейін рұқсат, `windowMs` ішінде. true = шектеуге жетті */
export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k)
    }
    return false
  }
  b.count++
  return b.count > limit
}

export function resetRateLimit(key: string) {
  buckets.delete(key)
}

/** IP клиента. За nginx берём X-Real-IP (nginx перезаписывает его), а не X-Forwarded-For,
 *  первое значение которого клиент может подставить сам и обойти ограничение попыток. */
export function clientIp(event: Parameters<typeof getRequestIP>[0]): string {
  return getRequestHeader(event, 'x-real-ip') || getRequestIP(event) || 'unknown'
}
