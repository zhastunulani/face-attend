import { db } from '~/server/db'
import { kpiTargets, attendance, employees, departments, schedules, leaves } from '~/server/db/schema'
import { eq, like, and } from 'drizzle-orm'
import { requireAuth, departmentScope } from '~/server/utils/auth'
import { parsePeriod } from '~/server/utils/period'
import { localNow, parseWorkDays, plannedWorkDates } from '~/server/utils/time'
import { loadHolidays, monthRange } from '~/server/utils/holidays'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const raw = getRouterParam(event, 'period') // e.g. "2026-03"
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad period', message: 'Кезең форматы: YYYY-MM' })
  }
  const { year, month, prefix: period } = parsePeriod(raw.slice(0, 4), raw.slice(5, 7))

  const scope = departmentScope(user)
  const allDepts = (await db.select().from(departments)).filter(d => scope === null || d.id === scope)
  const targets = await db.select().from(kpiTargets).where(eq(kpiTargets.period, period))
  const allSchedules = new Map((await db.select().from(schedules)).map(s => [s.id, s]))
  const records = await db.select().from(attendance).where(like(attendance.date, `${period}-%`))
  const approvedLeaves = await db.select().from(leaves).where(eq(leaves.status, 'approved'))
  const { from, to } = monthRange(year, month)
  const holidaySet = new Set((await loadHolidays(from, to)).keys())

  // Ағымдағы ай болса — тек бүгінге дейінгі күндер есептеледі
  const today = localNow().date
  const until = today.startsWith(period) ? today : undefined

  const results = []

  for (const dept of allDepts) {
    const deptEmployees = await db.select().from(employees)
      .where(and(eq(employees.departmentId, dept.id), eq(employees.isActive, true)))

    if (deptEmployees.length === 0) continue

    let totalPresent = 0
    let totalExpected = 0
    let totalOvertimeMin = 0
    let totalLateCount = 0

    for (const emp of deptEmployees) {
      const schedule = emp.scheduleId ? allSchedules.get(emp.scheduleId) : undefined
      const planned = plannedWorkDates(year, month, parseWorkDays(schedule?.workDays), until, holidaySet)
      // Бекітілген демалыс/больничный күндері күтілетін күндерге кірмейді
      const empLeaves = approvedLeaves.filter(l => l.employeeId === emp.id)
      const expected = planned.filter(d => !empLeaves.some(l => l.startDate <= d && d <= l.endDate))

      const empRecords = records.filter(r => r.employeeId === emp.id)
      totalPresent += empRecords.filter(r => r.checkIn && expected.includes(r.date)).length
      totalExpected += expected.length
      totalOvertimeMin += empRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0)
      totalLateCount += empRecords.filter(r => r.isLate).length
    }

    const attendanceRate = totalExpected > 0 ? (totalPresent / totalExpected) * 100 : 0
    const avgOvertimeHours = (totalOvertimeMin / 60) / deptEmployees.length

    results.push({
      departmentId: dept.id,
      departmentName: dept.name,
      employeeCount: deptEmployees.length,
      metrics: {
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        avgOvertimeHours: Math.round(avgOvertimeHours * 10) / 10,
        totalLateCount,
      },
      targets: targets.filter(t => t.departmentId === dept.id),
    })
  }

  return { period, departments: results }
})
