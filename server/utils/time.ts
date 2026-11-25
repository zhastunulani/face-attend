// Барлық уақыт есептеулері ұйымның уақыт белдеуінде (әдепкі: Алматы).
// Сервер (Render) UTC-де жұмыс істейді, сондықтан Date#toTimeString қолдануға болмайды.

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Almaty'

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
})

export interface LocalNow {
  date: string // YYYY-MM-DD
  time: string // HH:MM:SS
  weekday: number // 1 = дүйсенбі ... 7 = жексенбі
  minutes: number // күн басынан бергі минут
}

export function localNow(d: Date = new Date()): LocalNow {
  const parts: Record<string, string> = {}
  for (const p of formatter.formatToParts(d)) parts[p.type] = p.value
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const time = `${parts.hour}:${parts.minute}:${parts.second}`
  return { date, time, weekday: WEEKDAYS[parts.weekday], minutes: toMinutes(time) }
}

/** "HH:MM" немесе "HH:MM:SS" -> минут */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Келу/кету арасындағы минут; түнгі ауысымда (кету < келу) келесі күнге өтеді */
export function workedMinutes(checkIn: string, checkOut: string): number {
  let diff = toMinutes(checkOut) - toMinutes(checkIn)
  if (diff < 0) diff += 24 * 60
  return diff
}

/** YYYY-MM-DD күнінің апта күні (1 = дүйсенбі) — уақыт белдеуіне тәуелсіз */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return wd === 0 ? 7 : wd
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function monthDays(year: number, month: number): string[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`)
}

/** Кестенің жұмыс күндері (JSON [1..7]); кесте жоқ болса — дүйсенбі–жұма */
export function parseWorkDays(workDays: string | null | undefined): number[] {
  if (!workDays) return [1, 2, 3, 4, 5]
  try {
    const arr = JSON.parse(workDays)
    if (Array.isArray(arr) && arr.every(n => Number.isInteger(n) && n >= 1 && n <= 7)) return arr
  } catch {
    // ignore
  }
  return [1, 2, 3, 4, 5]
}

/** Айдағы жоспарлы жұмыс күндері (міндетті түрде `untilDate` қоса алғанда) */
export function plannedWorkDates(
  year: number,
  month: number,
  workDays: number[],
  untilDate?: string,
  holidays?: Set<string>,
): string[] {
  return monthDays(year, month).filter(d =>
    workDays.includes(weekdayOf(d)) && (!untilDate || d <= untilDate) && !holidays?.has(d))
}

export interface ScheduleLike {
  workStart: string
  workEnd: string
}

/** Кесте бойынша кешігу минуттары */
export function lateMinutesFor(checkInMinutes: number, schedule: ScheduleLike | null, graceMinutes = 0): number {
  if (!schedule) return 0
  const late = checkInMinutes - toMinutes(schedule.workStart)
  return late > graceMinutes ? late : 0
}

/** Кесте бойынша үстеме минуттар (кесте аяқталғаннан кейін). Түнгі ауысымды ескереді. */
export function overtimeMinutesFor(
  checkIn: string,
  checkOut: string,
  schedule: ScheduleLike | null,
  standardHoursPerDay: number,
): number {
  const worked = workedMinutes(checkIn, checkOut)
  if (!schedule) return Math.max(0, worked - standardHoursPerDay * 60)

  const start = toMinutes(schedule.workStart)
  let end = toMinutes(schedule.workEnd)
  if (end <= start) end += 24 * 60 // түнгі ауысым

  const inAbs = toMinutes(checkIn)
  const outAbs = inAbs + worked
  return Math.max(0, outAbs - end)
}

/** Кесте өрістерін тексеру (POST/PUT /api/schedules) */
export function validateScheduleInput(body: any, partial: boolean) {
  const out: Record<string, string> = {}
  const bad = (message: string) => createError({ statusCode: 400, statusMessage: 'Bad schedule', message })
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 100) throw bad('Кесте атауы қажет')
    out.name = name
  }
  if (body.type !== undefined || !partial) {
    if (!['5/2', '2/2', '6/1', 'shift', 'free'].includes(body.type)) throw bad('Кесте түрі қате')
    out.type = body.type
  }
  for (const key of ['workStart', 'workEnd'] as const) {
    if (body[key] !== undefined || !partial) {
      if (typeof body[key] !== 'string' || !timeRe.test(body[key])) throw bad('Уақыт форматы: HH:MM')
      out[key] = body[key]
    }
  }
  if (body.workDays !== undefined || !partial) {
    let days = body.workDays
    if (typeof days === 'string') {
      try { days = JSON.parse(days) } catch { days = null }
    }
    if (!Array.isArray(days) || !days.length || !days.every((d: unknown) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 7)) {
      throw bad('Жұмыс күндері: 1–7 сандарының тізімі')
    }
    out.workDays = JSON.stringify([...new Set(days as number[])].sort())
  }
  return out
}
