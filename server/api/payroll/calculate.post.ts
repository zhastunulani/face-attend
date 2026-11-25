import { db } from '~/server/db'
import { payroll, attendance, employees, salarySettings, schedules } from '~/server/db/schema'
import { eq, like, and } from 'drizzle-orm'
import { requireRole } from '~/server/utils/auth'
import { parsePeriod } from '~/server/utils/period'
import { workedMinutes, weekdayOf, parseWorkDays, plannedWorkDates } from '~/server/utils/time'
import { audit } from '~/server/utils/audit'
import { loadHolidays, monthRange } from '~/server/utils/holidays'

/**
 * Жалақы есебі (salaryRate = айлық оклад):
 *   сағаттық мөлшерлеме = оклад / (айдағы жоспарлы жұмыс күндері × күндік стандарт сағат)
 *   қалыпты сағат  = әр жұмыс күнінде min(жұмыс − үстеме, стандарт) — түскі үзіліс төленбейді
 *   үстеме сағат   = кесте аяқталғаннан кейінгі уақыт × overtimeCoefficient
 *   демалыс күні   = кестеде жоқ немесе мереке күні жұмыс істелген уақыт × weekendCoefficient
 *   мерекелер жоспарлы жұмыс күндеріне кірмейді
 * Бұрынғы нұсқада үстеме екі рет төленетін (негізгі сомада да, үстеме сомада да).
 */
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const body = await readBody(event)
  const { year, month, prefix } = parsePeriod(body?.year, body?.month)

  const [settings] = await db.select().from(salarySettings)
  if (!settings) throw createError({ statusCode: 500, statusMessage: 'No settings', message: 'Айлық баптаулары табылмады' })
  const stdMinutes = settings.standardHoursPerDay * 60

  const allSchedules = await db.select().from(schedules)
  const scheduleById = new Map(allSchedules.map(s => [s.id, s]))
  const activeEmployees = await db.select().from(employees).where(eq(employees.isActive, true))
  const monthRecords = await db.select().from(attendance).where(like(attendance.date, `${prefix}-%`))
  const { from, to } = monthRange(year, month)
  const holidaySet = new Set((await loadHolidays(from, to)).keys())

  const round2 = (n: number) => Math.round(n * 100) / 100
  const results = []

  for (const emp of activeEmployees) {
    const schedule = emp.scheduleId ? scheduleById.get(emp.scheduleId) : undefined
    const workDays = parseWorkDays(schedule?.workDays)
    const plannedDays = plannedWorkDates(year, month, workDays, undefined, holidaySet).length
    const hourlyRate = emp.salaryRate > 0 && plannedDays > 0 ? emp.salaryRate / (plannedDays * settings.standardHoursPerDay) : 0

    let regularMin = 0
    let overtimeMin = 0
    let weekendMin = 0
    let daysWorked = 0

    for (const r of monthRecords) {
      if (r.employeeId !== emp.id || !r.checkIn || !r.checkOut) continue
      const worked = workedMinutes(r.checkIn, r.checkOut)
      if (worked <= 0) continue
      daysWorked++
      if (!workDays.includes(weekdayOf(r.date)) || holidaySet.has(r.date)) {
        weekendMin += worked
        continue
      }
      const overtime = Math.min(r.overtimeMinutes, worked)
      overtimeMin += overtime
      regularMin += Math.min(worked - overtime, stdMinutes)
    }

    const regularHours = regularMin / 60
    const overtimeHours = overtimeMin / 60
    const weekendHours = weekendMin / 60
    const baseAmount = Math.round(regularHours * hourlyRate)
    const overtimeAmount = Math.round(overtimeHours * hourlyRate * settings.overtimeCoefficient)
    const weekendAmount = Math.round(weekendHours * hourlyRate * settings.weekendCoefficient)

    const payrollData = {
      employeeId: emp.id,
      month,
      year,
      workDays: daysWorked,
      plannedDays,
      workHours: round2(regularHours + overtimeHours + weekendHours),
      regularHours: round2(regularHours),
      overtimeHours: round2(overtimeHours),
      weekendHours: round2(weekendHours),
      baseAmount,
      overtimeAmount,
      weekendAmount,
      deductions: 0,
      totalAmount: baseAmount + overtimeAmount + weekendAmount,
    }

    const [existing] = await db.select({ id: payroll.id }).from(payroll)
      .where(and(eq(payroll.employeeId, emp.id), eq(payroll.month, month), eq(payroll.year, year)))
    if (existing) {
      await db.update(payroll).set(payrollData).where(eq(payroll.id, existing.id))
    } else {
      await db.insert(payroll).values(payrollData)
    }

    results.push({ ...payrollData, employeeName: emp.name })
  }

  await audit(user.id, 'payroll_calculated', { period: prefix, employees: results.length })
  return { month: prefix, results }
})
