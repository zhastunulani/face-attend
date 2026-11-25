import { desc, eq, like, and, type SQL } from 'drizzle-orm'
import { db } from '~/server/db'
import { auditLog, users } from '~/server/db/schema'
import { requireRole } from '~/server/utils/auth'

// Әрекеттер журналы (тек admin): кірулер, белгілер, түзетулер, жалақы есебі т.б.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const q = getQuery(event)
  const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500)
  const offset = Math.max(Number(q.offset) || 0, 0)

  const conds: SQL[] = []
  if (typeof q.action === 'string' && /^[a-z_]{2,40}$/.test(q.action)) conds.push(like(auditLog.action, `${q.action}%`))

  const rows = await db.select({
    id: auditLog.id,
    action: auditLog.action,
    details: auditLog.details,
    createdAt: auditLog.createdAt,
    userId: auditLog.userId,
    userName: users.name,
    userLogin: users.login,
  }).from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.id))
    .limit(limit)
    .offset(offset)

  return rows.map((r) => {
    let details: unknown = r.details
    try { details = r.details ? JSON.parse(r.details) : null } catch { /* мәтін күйінде */ }
    return { ...r, details }
  })
})
