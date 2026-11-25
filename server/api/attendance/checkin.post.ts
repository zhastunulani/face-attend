import { db } from '~/server/db'
import { attendance, schedules, salarySettings, kiosks } from '~/server/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { getKiosk, getAuthUser } from '~/server/utils/auth'
import { parseDescriptor, matchFace } from '~/server/utils/face'
import { saveImage } from '~/server/utils/files'
import { audit, hitRateLimit, clientIp } from '~/server/utils/audit'
import { localNow, addDays, workedMinutes, lateMinutesFor, overtimeMinutesFor, toMinutes, humanMinutes } from '~/server/utils/time'

const MIN_WORK_MINUTES = 30
const MAX_SHIFT_MINUTES = 18 * 60 // түнгі ауысымды кешегі күнге жатқызу шегі

const fail = (statusCode: number, message: string) =>
  createError({ statusCode, statusMessage: 'Check-in rejected', message })

export default defineEventHandler(async (event) => {
  // 1. Кім жазып жатыр: тіркелген киоск немесе admin/head
  const kiosk = await getKiosk(event)
  const user = kiosk ? null : await getAuthUser(event)
  if (!kiosk && !(user && !user.mustChangePassword && (user.role === 'admin' || user.role === 'head'))) {
    throw fail(401, 'Бұл құрылғы киоск ретінде тіркелмеген')
  }
  const source = kiosk ? `kiosk:${kiosk.id}` : `user:${user!.id}`
  const actorId = kiosk ? kiosk.createdBy : user!.id

  if (hitRateLimit(`checkin:${source}:${clientIp(event)}`, 30, 60_000)) {
    throw fail(429, 'Тым жиі сұраныс. Біраз күтіңіз')
  }

  // 2. Дене валидациясы
  const body = await readBody(event)
  // Киосктың режимі (кіреберіс/шығу есігі) клиент жіберген түрден басым
  const type = kiosk && kiosk.mode !== 'auto' ? kiosk.mode : body?.type
  if (!['in', 'out', 'auto'].includes(type)) throw fail(400, 'type "in", "out" немесе "auto" болуы керек')
  const rawList = Array.isArray(body?.descriptors) ? body.descriptors : []
  if (rawList.length < 1 || rawList.length > 5) throw fail(400, '1–5 бет дескрипторы қажет')
  const descriptors = rawList.map(parseDescriptor)
  if (descriptors.some((d: number[] | null) => !d)) throw fail(400, 'Дескриптор форматы қате (128 сан)')

  // 3. Бетті серверде салыстыру (клиент employeeId жібермейді)
  const match = await matchFace(descriptors as number[][])
  if (!match.ok) {
    await audit(actorId, 'checkin_rejected', { source, reason: match.reason })
    const msg = match.reason === 'ambiguous'
      ? 'Бет сенімді анықталмады. Камераға тура қарап, қайталаңыз'
      : 'Жүйеде тіркелген қызметкер табылмады'
    throw fail(404, msg)
  }
  const employee = match.employee

  // Head тек өз бөлімінің қызметкерлерін тіркей алады
  if (user?.role === 'head' && employee.departmentId !== user.departmentId) {
    throw fail(403, 'Бұл қызметкер сіздің бөліміңізде емес')
  }

  const now = localNow()
  const [schedule] = employee.scheduleId
    ? await db.select().from(schedules).where(eq(schedules.id, employee.scheduleId))
    : [null]
  const [settings] = await db.select().from(salarySettings)
  const stdHours = settings?.standardHoursPerDay ?? 8

  // 4. Ашық жазбаны табу: бүгінгі, немесе кешегі аяқталмаған (түнгі ауысым)
  const findRecord = async (date: string) =>
    (await db.select().from(attendance).where(and(eq(attendance.employeeId, employee.id), eq(attendance.date, date))))[0]

  const today = await findRecord(now.date)
  let open = today?.checkIn && !today.checkOut ? today : undefined
  if (!today?.checkIn) {
    const yesterday = await findRecord(addDays(now.date, -1))
    if (yesterday?.checkIn && !yesterday.checkOut && workedMinutes(yesterday.checkIn, now.time) <= MAX_SHIFT_MINUTES
      && workedMinutes(yesterday.checkIn, now.time) > 0 && now.minutes < 12 * 60) {
      open = yesterday
    }
  }

  const action: 'in' | 'out' = type === 'auto' ? (open ? 'out' : 'in') : type
  if (type === 'auto' && open && workedMinutes(open.checkIn!, now.time) < MIN_WORK_MINUTES) {
    const wait = MIN_WORK_MINUTES - workedMinutes(open.checkIn!, now.time)
    return {
      success: false, code: 'already_in', employeeName: employee.name, time: open.checkIn,
      message: `Келуіңіз ${open.checkIn!.slice(0, 5)}-де тіркелген. Кетуді ${wait} минуттан кейін белгілеуге болады`,
    }
  }

  const photoPath = body.photo ? await saveImage(body.photo, 'checkin') : null
  if (kiosk) await db.update(kiosks).set({ lastSeenAt: new Date().toISOString() }).where(eq(kiosks.id, kiosk.id))

  // 5. Келу
  if (action === 'in') {
    if (today?.checkIn) {
      return { success: false, code: 'already_in', employeeName: employee.name, message: `Бүгінгі келуіңіз ${today.checkIn.slice(0, 5)}-де тіркелген`, time: today.checkIn }
    }
    if (open) {
      return { success: false, code: 'open_shift', employeeName: employee.name, message: `Алдыңғы ауысымнан (${open.checkIn!.slice(0, 5)}) кету белгіленбеген. Әкімшіге хабарлаңыз`, time: open.checkIn }
    }
    const lateMinutes = lateMinutesFor(now.minutes, schedule)
    const values = {
      checkIn: now.time,
      checkInPhoto: photoPath,
      isLate: lateMinutes > 0,
      lateMinutes,
      status: 'present',
      source,
      matchDistance: match.distance,
    }
    if (today) {
      // Мысалы, бұрын 'absent' деп белгіленген жазба
      await db.update(attendance).set(values).where(and(eq(attendance.id, today.id), isNull(attendance.checkIn)))
    } else {
      const inserted = await db.insert(attendance).values({ employeeId: employee.id, date: now.date, ...values })
        .onConflictDoNothing().returning()
      if (!inserted.length) {
        return { success: false, code: 'already_in', employeeName: employee.name, message: 'Бүгінгі келуіңіз тіркелген' }
      }
    }
    await audit(actorId, 'checkin', { source, employeeId: employee.id, distance: Number(match.distance.toFixed(3)) })

    return {
      success: true,
      employeeName: employee.name,
      type: 'in',
      time: now.time,
      isLate: lateMinutes > 0,
      lateMinutes,
      scheduleStart: schedule?.workStart ?? null,
      scheduleEnd: schedule?.workEnd ?? null,
      message: lateMinutes > 0
        ? `Жұмыс ${schedule!.workStart}-де басталады — ${humanMinutes(lateMinutes)} кешіктіңіз`
        : schedule ? `Жұмыс ${schedule.workStart}-де басталады — уақытында келдіңіз` : 'Келуіңіз тіркелді',
    }
  }

  // 6. Кету
  if (!open) {
    if (today?.checkOut) {
      return { success: false, code: 'already_out', employeeName: employee.name, message: `Бүгінгі кетуіңіз ${today.checkOut.slice(0, 5)}-де тіркелген`, time: today.checkOut }
    }
    throw fail(400, 'Алдымен келуді тіркеңіз')
  }
  const worked = workedMinutes(open.checkIn!, now.time)
  if (worked < MIN_WORK_MINUTES) {
    throw fail(400, `Келу мен кету арасы кемінде ${MIN_WORK_MINUTES} минут болуы керек`)
  }
  const overtimeMinutes = overtimeMinutesFor(open.checkIn!, now.time, schedule, stdHours)

  const updated = await db.update(attendance).set({ checkOut: now.time, checkOutPhoto: photoPath, overtimeMinutes })
    .where(and(eq(attendance.id, open.id), isNull(attendance.checkOut))).returning()
  if (!updated.length) {
    return { success: false, employeeName: employee.name, message: 'Кету тіркелген' }
  }
  await audit(actorId, 'checkout', { source, employeeId: employee.id, distance: Number(match.distance.toFixed(3)) })

  // Ерте кету (күндізгі кестеде ғана)
  let earlyLeaveMinutes = 0
  if (schedule && toMinutes(schedule.workEnd) > toMinutes(schedule.workStart) && toMinutes(now.time) > toMinutes(open.checkIn!)) {
    earlyLeaveMinutes = Math.max(0, toMinutes(schedule.workEnd) - now.minutes)
  }

  return {
    success: true,
    employeeName: employee.name,
    type: 'out',
    time: now.time,
    checkIn: open.checkIn,
    workedMinutes: worked,
    overtimeMinutes,
    earlyLeaveMinutes,
    scheduleStart: schedule?.workStart ?? null,
    scheduleEnd: schedule?.workEnd ?? null,
    message: overtimeMinutes > 0
      ? `Бүгін ${humanMinutes(worked)} жұмыс істедіңіз, оның ${humanMinutes(overtimeMinutes)} — үстеме`
      : earlyLeaveMinutes > 0
        ? `Жұмыс ${schedule!.workEnd}-де аяқталады — ${humanMinutes(earlyLeaveMinutes)} ерте кеттіңіз`
        : `Бүгін ${humanMinutes(worked)} жұмыс істедіңіз`,
  }
})
