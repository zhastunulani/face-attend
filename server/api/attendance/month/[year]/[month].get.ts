import { and, eq, inArray, lte, gte, or, type SQL } from 'drizzle-orm'
import { db } from '~/server/db'
import { employees, schedules, leaves } from '~/server/db/schema'
import { requireAuth, departmentScope } from '~/server/utils/auth'
import { parsePeriod, monthAttendance } from '~/server/utils/period'
import { workedMinutes, weekdayOf, monthDays, parseWorkDays, localNow, startDateOf } from '~/server/utils/time'
import { loadHolidays, monthRange } from '~/server/utils/holidays'

/**
 * Айлық табель-тор: әр қызметкер × әр күн.
 * Келмеген күндер = кесте бойынша жұмыс күні (бүгінге дейін), мереке емес, бекітілген демалыста емес, белгі жоқ.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { year, month, prefix } = parsePeriod(getRouterParam(event, 'year'), getRouterParam(event, 'month'))
  const scope = departmentScope(user)
  const { from, to } = monthRange(year, month)
  const today = localNow().date

  const records = await monthAttendance(prefix, scope)
  const withRecords = [...new Set(records.map(r => r.employeeId))]

  // Белсенді қызметкерлер + осы айда белгісі бар (кейін шығарылған) қызметкерлер
  const conds: SQL[] = [withRecords.length ? or(eq(employees.isActive, true), inArray(employees.id, withRecords))! : eq(employees.isActive, true)]
  if (scope !== null) conds.push(eq(employees.departmentId, scope))
  const emps = await db.select({
    id: employees.id, name: employees.name, departmentId: employees.departmentId, scheduleId: employees.scheduleId,
    createdAt: employees.createdAt,
  }).from(employees).where(and(...conds)).orderBy(employees.name)

  const scheduleMap = new Map((await db.select().from(schedules)).map(s => [s.id, s]))
  const holidayMap = await loadHolidays(from, to)
  const approvedLeaves = await db.select().from(leaves).where(and(
    eq(leaves.status, 'approved'), lte(leaves.startDate, to), gte(leaves.endDate, from),
  ))

  const days = monthDays(year, month).map(date => ({
    date,
    weekday: weekdayOf(date),
    holiday: holidayMap.get(date) ?? null,
  }))

  const result = emps.map((emp) => {
    const workDays = parseWorkDays(emp.scheduleId ? scheduleMap.get(emp.scheduleId)?.workDays : null)
    const empLeaves = approvedLeaves.filter(l => l.employeeId === emp.id)
    const startDate = startDateOf(emp.createdAt)
    const cells: Record<string, any> = {}
    const leaveDays: Record<string, string> = {}
    let daysPresent = 0, daysLate = 0, absentDays = 0, plannedDays = 0
    let totalWorkMinutes = 0, totalOvertimeMinutes = 0, totalLateMinutes = 0

    for (const r of records) {
      if (r.employeeId !== emp.id) continue
      cells[r.date] = {
        id: r.id, checkIn: r.checkIn, checkOut: r.checkOut, isLate: r.isLate,
        lateMinutes: r.lateMinutes, overtimeMinutes: r.overtimeMinutes,
      }
      if (!r.checkIn) continue
      daysPresent++
      if (r.isLate) { daysLate++; totalLateMinutes += r.lateMinutes }
      totalOvertimeMinutes += r.overtimeMinutes
      if (r.checkOut) totalWorkMinutes += workedMinutes(r.checkIn, r.checkOut)
    }

    for (const d of days) {
      const leave = empLeaves.find(l => l.startDate <= d.date && d.date <= l.endDate)
      if (leave) leaveDays[d.date] = leave.type
      const isWorkDay = workDays.includes(d.weekday) && !d.holiday
      // Жұмысқа қосылғанға дейінгі күндер жоспарға да, «келмеді»-ге де кірмейді
      if (!isWorkDay || (d.date < startDate && !cells[d.date]?.checkIn)) continue
      plannedDays++
      if (d.date <= today && !leave && !cells[d.date]?.checkIn) absentDays++
    }

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      startDate,
      departmentId: emp.departmentId,
      workDays,
      plannedDays,
      daysPresent,
      daysLate,
      absentDays,
      leaveDayCount: Object.keys(leaveDays).length,
      totalWorkMinutes,
      totalOvertimeMinutes,
      totalLateMinutes,
      cells,
      leaveDays,
    }
  })

  return { month: prefix, today, days, employees: result }
})
