import { and, gte, lte } from 'drizzle-orm'
import { db } from '~/server/db'
import { holidays } from '~/server/db/schema'

/** Кезеңдегі мерекелер: күн -> атауы */
export async function loadHolidays(from: string, to: string): Promise<Map<string, string>> {
  const rows = await db.select().from(holidays).where(and(gte(holidays.date, from), lte(holidays.date, to)))
  return new Map(rows.map(r => [r.date, r.name]))
}

export function monthRange(year: number, month: number) {
  const mm = String(month).padStart(2, '0')
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` }
}
