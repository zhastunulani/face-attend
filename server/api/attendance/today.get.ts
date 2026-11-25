import { and, eq, lte, gte } from 'drizzle-orm'
import { db } from '~/server/db'
import { attendance, employees, schedules, departments, leaves } from '~/server/db/schema'
import { requireAuth, departmentScope } from '~/server/utils/auth'
import { localNow, parseWorkDays, toMinutes, workedMinutes } from '~/server/utils/time'
import { loadHolidays } from '~/server/utils/holidays'

/**
 * Бүгінгі табель: әр қызметкерге бір жол, нақты күй және түсінікті сандар.
 *
 * status:
 *   in_office — келді, әлі кеңседе
 *   left      — келді және кетті
 *   expected  — жұмыс күні, белгі жоқ, бірақ жұмыс әлі басталмаған
 *   absent    — жұмыс күні, жұмыс басталды, белгі жоқ
 *   leave     — бекітілген демалыс/ауру
 *   day_off   — кесте бойынша демалыс күні немесе мереке
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const now = localNow()
  const today = now.date
  const scope = departmentScope(user)

  const empConds = [eq(employees.isActive, true)]
  if (scope !== null) empConds.push(eq(employees.departmentId, scope))
  const emps = await db.select({
    id: employees.id,
    name: employees.name,
    departmentId: employees.departmentId,
    scheduleId: employees.scheduleId,
  }).from(employees).where(and(...empConds)).orderBy(employees.name)

  const records = await db.select().from(attendance).where(eq(attendance.date, today))
  const recordMap = new Map(records.map(r => [r.employeeId, r]))
  const scheduleMap = new Map((await db.select().from(schedules)).map(s => [s.id, s]))
  const deptMap = new Map((await db.select().from(departments)).map(d => [d.id, d.name]))
  const holiday = (await loadHolidays(today, today)).get(today) ?? null
  const todayLeaves = await db.select().from(leaves).where(and(
    eq(leaves.status, 'approved'), lte(leaves.startDate, today), gte(leaves.endDate, today),
  ))
  const leaveMap = new Map(todayLeaves.map(l => [l.employeeId, l.type]))

  const rows = emps.map((e) => {
    const schedule = e.scheduleId ? scheduleMap.get(e.scheduleId) ?? null : null
    const workDays = parseWorkDays(schedule?.workDays)
    const isWorkDay = workDays.includes(now.weekday) && !holiday
    const r = recordMap.get(e.id)
    const leave = leaveMap.get(e.id) ?? null

    let status: 'in_office' | 'left' | 'expected' | 'absent' | 'leave' | 'day_off'
    if (r?.checkIn) status = r.checkOut ? 'left' : 'in_office'
    else if (leave) status = 'leave'
    else if (!isWorkDay) status = 'day_off'
    else if (schedule && now.minutes < toMinutes(schedule.workStart)) status = 'expected'
    else status = 'absent'

    // Ерте кету: кесте аяқталмай кетсе (түнгі ауысымды есептемейміз)
    let earlyLeaveMinutes = 0
    if (r?.checkIn && r.checkOut && schedule && toMinutes(schedule.workEnd) > toMinutes(schedule.workStart)) {
      const diff = toMinutes(schedule.workEnd) - toMinutes(r.checkOut)
      if (diff > 0 && toMinutes(r.checkOut) > toMinutes(r.checkIn)) earlyLeaveMinutes = diff
    }

    return {
      employeeId: e.id,
      employeeName: e.name,
      departmentName: e.departmentId ? deptMap.get(e.departmentId) ?? null : null,
      schedule: schedule ? { name: schedule.name, start: schedule.workStart, end: schedule.workEnd } : null,
      isWorkDay,
      status,
      leaveType: leave,
      id: r?.id ?? null,
      checkIn: r?.checkIn ?? null,
      checkOut: r?.checkOut ?? null,
      lateMinutes: r?.checkIn ? r.lateMinutes : 0,
      overtimeMinutes: r?.overtimeMinutes ?? 0,
      earlyLeaveMinutes,
      // Кеңседегілер үшін — қазірге дейін
      workedMinutes: r?.checkIn ? workedMinutes(r.checkIn, r.checkOut ?? now.time) : 0,
      edited: !!r?.source?.startsWith('manual'),
    }
  })

  const count = (s: string) => rows.filter(r => r.status === s).length
  return {
    date: today,
    now: now.time.slice(0, 5),
    holiday,
    rows,
    stats: {
      total: rows.length,
      expectedToday: rows.filter(r => r.isWorkDay && r.status !== 'leave').length,
      came: count('in_office') + count('left'),
      inOffice: count('in_office'),
      left: count('left'),
      late: rows.filter(r => r.lateMinutes > 0).length,
      absent: count('absent'),
      expected: count('expected'),
      leave: count('leave'),
      dayOff: count('day_off'),
    },
  }
})
