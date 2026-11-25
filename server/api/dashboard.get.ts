import { and, eq, gte, lte, type SQL } from 'drizzle-orm'
import { db } from '~/server/db'
import { attendance, employees, schedules, leaves } from '~/server/db/schema'
import { requireAuth, departmentScope } from '~/server/utils/auth'
import { localNow, addDays, weekdayOf, parseWorkDays } from '~/server/utils/time'
import { loadHolidays } from '~/server/utils/holidays'

/**
 * Басты бет үшін бір сұраныс:
 *  - бүгін: келгендер, кешіккендер, қазір кеңседе, келмегендер (демалыстағыларсыз)
 *  - аяқталмаған ауысымдар (соңғы 14 күн): кетуді белгілемегендер — түзету қажет
 *  - соңғы 7 күндегі қатысу (жоспар / нақты)
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const scope = departmentScope(user)
  const now = localNow()
  const weekStart = addDays(now.date, -6)

  const empConds: SQL[] = [eq(employees.isActive, true)]
  if (scope !== null) empConds.push(eq(employees.departmentId, scope))
  const emps = await db.select({
    id: employees.id, name: employees.name, departmentId: employees.departmentId, scheduleId: employees.scheduleId,
  }).from(employees).where(and(...empConds)).orderBy(employees.name)
  const empIds = new Set(emps.map(e => e.id))
  const scheduleMap = new Map((await db.select().from(schedules)).map(s => [s.id, s]))

  const recent = (await db.select().from(attendance)
    .where(and(gte(attendance.date, addDays(now.date, -13)), lte(attendance.date, now.date))))
    .filter(r => empIds.has(r.employeeId))
  const holidays = await loadHolidays(addDays(now.date, -13), now.date)
  const approved = await db.select().from(leaves).where(and(
    eq(leaves.status, 'approved'), lte(leaves.startDate, now.date), gte(leaves.endDate, weekStart),
  ))
  const onLeave = (empId: number, date: string) =>
    approved.find(l => l.employeeId === empId && l.startDate <= date && date <= l.endDate)
  const nameOf = new Map(emps.map(e => [e.id, e.name]))
  const isPlanned = (empId: number, date: string) => {
    const emp = emps.find(e => e.id === empId)!
    const workDays = parseWorkDays(emp.scheduleId ? scheduleMap.get(emp.scheduleId)?.workDays : null)
    return workDays.includes(weekdayOf(date)) && !holidays.has(date) && !onLeave(empId, date)
  }

  // Бүгін
  const today = recent.filter(r => r.date === now.date && r.checkIn)
  const todayIds = new Set(today.map(r => r.employeeId))
  const inOffice = today.filter(r => !r.checkOut)
    .map(r => ({ employeeId: r.employeeId, name: nameOf.get(r.employeeId), checkIn: r.checkIn, isLate: r.isLate, lateMinutes: r.lateMinutes }))
    .sort((a, b) => a.checkIn!.localeCompare(b.checkIn!))
  const left = today.filter(r => r.checkOut)
    .map(r => ({ employeeId: r.employeeId, name: nameOf.get(r.employeeId), checkIn: r.checkIn, checkOut: r.checkOut }))
  const late = today.filter(r => r.isLate)
    .map(r => ({ employeeId: r.employeeId, name: nameOf.get(r.employeeId), checkIn: r.checkIn, lateMinutes: r.lateMinutes }))
    .sort((a, b) => b.lateMinutes - a.lateMinutes)
  const leaveToday = emps.filter(e => onLeave(e.id, now.date))
    .map(e => ({ employeeId: e.id, name: e.name, type: onLeave(e.id, now.date)!.type }))
  const notArrived = emps.filter(e => !todayIds.has(e.id) && isPlanned(e.id, now.date))
    .map(e => ({ employeeId: e.id, name: e.name }))

  // Аяқталмаған ауысымдар (кешегі және одан бұрынғы)
  const openShifts = recent.filter(r => r.date < now.date && r.checkIn && !r.checkOut)
    .map(r => ({ id: r.id, employeeId: r.employeeId, name: nameOf.get(r.employeeId), date: r.date, checkIn: r.checkIn }))
    .sort((a, b) => b.date.localeCompare(a.date))

  // Соңғы 7 күн
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((date) => {
    const planned = emps.filter(e => isPlanned(e.id, date)).length
    const present = recent.filter(r => r.date === date && r.checkIn).length
    return { date, weekday: weekdayOf(date), holiday: holidays.get(date) ?? null, planned, present }
  })

  return {
    date: now.date,
    time: now.time.slice(0, 5),
    stats: {
      total: emps.length,
      present: todayIds.size,
      inOffice: inOffice.length,
      late: late.length,
      onLeave: leaveToday.length,
      notArrived: notArrived.length,
      holiday: holidays.get(now.date) ?? null,
    },
    inOffice,
    left,
    late,
    leaveToday,
    notArrived,
    openShifts,
    week,
  }
})
