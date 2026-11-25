export const WEEKDAYS_LONG = ['', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі', 'жексенбі']
export const WEEKDAYS_SHORT = ['', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс']
export const MONTHS = ['Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан']

export const LEAVE_LABELS: Record<string, string> = {
  vacation: 'Демалыс',
  sick: 'Ауру',
  maternity: 'Декрет',
  other: 'Басқа',
}

/** "2026-11-08" -> "8 қараша" */
export const formatDay = (date: string) => {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1].toLowerCase()}`
}

/** минут -> "7 сағ 30 мин" */
export const formatMinutes = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} мин`
  return m ? `${h} сағ ${m} мин` : `${h} сағ`
}

export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '—')

// Браузерлерде kk-KZ локалі толық емес («МП 8, Mon») — сондықтан күн/уақытты өзіміз пішімдейміз
const pad = (n: number) => String(n).padStart(2, '0')

/** Date -> "17:32" */
export const clockText = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Date -> "дүйсенбі, 9 қараша" */
export const longDateText = (d: Date) =>
  `${WEEKDAYS_LONG[d.getDay() === 0 ? 7 : d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`

/** Date -> "09.11.2026 17:32" */
export const dateTimeText = (d: Date) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${clockText(d)}`
