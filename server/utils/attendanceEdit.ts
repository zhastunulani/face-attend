import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { employees, schedules, salarySettings } from '~/server/db/schema'
import type { AuthUser } from '~/server/utils/auth'
import { assertDepartmentAccess } from '~/server/utils/auth'
import { toMinutes, lateMinutesFor, overtimeMinutesFor, weekdayOf } from '~/server/utils/time'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

const bad = (message: string) => createError({ statusCode: 400, statusMessage: 'Bad request', message })

/** "HH:MM" -> "HH:MM:00" */
function normTime(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !TIME_RE.test(v)) throw bad(`${field}: уақыт форматы HH:MM`)
  return v.length === 5 ? `${v}:00` : v
}

/**
 * Қолмен түзетудің ортақ логикасы: уақытты тексеру, кешігу мен үстемені кесте бойынша қайта есептеу.
 * Себеп (note) міндетті — бұл жалақыға әсер ететін өзгеріс.
 */
export async function buildManualRecord(user: AuthUser, employeeId: number, date: string, body: any) {
  const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId))
  if (!emp) throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Қызметкер табылмады' })
  assertDepartmentAccess(user, emp.departmentId)

  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : ''
  if (note.length < 3) throw bad('Түзету себебін жазыңыз')

  const checkIn = normTime(body?.checkIn, 'Келу')
  const checkOut = normTime(body?.checkOut, 'Кету')
  if (!checkIn) throw bad('Келу уақыты қажет')
  if (checkOut && toMinutes(checkOut) === toMinutes(checkIn)) throw bad('Келу мен кету бірдей болмауы керек')

  const [schedule] = emp.scheduleId ? await db.select().from(schedules).where(eq(schedules.id, emp.scheduleId)) : [null]
  const [settings] = await db.select().from(salarySettings)
  const lateMinutes = lateMinutesFor(toMinutes(checkIn), schedule, weekdayOf(date))
  const overtimeMinutes = checkOut ? overtimeMinutesFor(checkIn, checkOut, schedule, settings?.standardHoursPerDay ?? 8) : 0

  return {
    employee: emp,
    values: {
      checkIn,
      checkOut,
      isLate: lateMinutes > 0,
      lateMinutes,
      overtimeMinutes,
      status: 'present',
      note,
      source: `manual:${user.id}`,
    },
  }
}
