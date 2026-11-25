<template>
  <div class="max-w-[100rem] mx-auto px-4 py-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="page-title">Табель</h1>
        <p class="page-subtitle">Келу-кету есебі{{ canEdit ? ' · ұяшықты басып түзетуге болады' : '' }}</p>
      </div>
      <div class="flex gap-2">
        <button :class="activeTab === 'today' ? 'btn-primary' : 'btn-secondary'" @click="activeTab = 'today'">Бүгін</button>
        <button :class="activeTab === 'monthly' ? 'btn-primary' : 'btn-secondary'" @click="activeTab = 'monthly'">Айлық</button>
      </div>
    </div>

    <!-- ==================== Бүгін ==================== -->
    <template v-if="activeTab === 'today'">
      <div v-if="loadingToday && !todayData" class="card text-center py-8 text-gray-400">Жүктелуде...</div>
      <template v-else-if="todayData">
        <p class="text-sm text-gray-500 mb-3">
          {{ longDateText(new Date()) }} · қазір {{ todayData.now }}
          <span v-if="todayData.holiday" class="ml-1 badge bg-purple-100 text-purple-700">{{ todayData.holiday }}</span>
        </p>

        <!-- Қорытынды = сүзгі -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          <button
            v-for="f in todayFilters" :key="f.key" type="button"
            class="rounded-xl border px-3 py-2.5 text-left transition-colors"
            :class="todayFilter === f.key ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-gray-200 bg-white hover:border-gray-300'"
            @click="todayFilter = f.key"
          >
            <p class="text-xs text-gray-500">{{ f.label }}</p>
            <p class="text-xl font-semibold tabular-nums" :class="f.tone">{{ f.count }}</p>
          </button>
        </div>

        <div class="card !p-0 overflow-hidden">
          <div class="p-3 border-b border-gray-100">
            <input v-model="todaySearch" class="input" placeholder="Қызметкерді іздеу..." />
          </div>
          <div v-if="!visibleToday.length" class="text-center py-8 text-gray-400">Бұл сүзгі бойынша ешкім жоқ</div>

          <!-- Desktop: кесте -->
          <table v-else class="hidden md:table w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="px-4 py-2.5 font-semibold">Қызметкер</th>
                <th class="px-4 py-2.5 font-semibold">Кесте</th>
                <th class="px-4 py-2.5 font-semibold">Келді</th>
                <th class="px-4 py-2.5 font-semibold">Кетті</th>
                <th class="px-4 py-2.5 font-semibold">Жұмыс уақыты</th>
                <th class="px-4 py-2.5 font-semibold">Күйі</th>
                <th v-if="canEdit" class="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="r in visibleToday" :key="r.employeeId" class="hover:bg-gray-50">
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-900">{{ r.employeeName }}</p>
                  <p v-if="r.departmentName" class="text-xs text-gray-500">{{ r.departmentName }}</p>
                </td>
                <td class="px-4 py-3 tabular-nums text-gray-600">
                  <template v-if="r.schedule && r.isWorkDay">{{ r.schedule.start }}–{{ r.schedule.end }}</template>
                  <span v-else-if="!r.isWorkDay" class="text-gray-400">демалыс күні</span>
                  <span v-else class="text-gray-400">кестесіз</span>
                </td>
                <td class="px-4 py-3">
                  <p class="tabular-nums font-medium">{{ r.checkIn ? hhmm(r.checkIn) : '' }}</p>
                  <p v-if="r.lateMinutes" class="text-xs text-orange-600">{{ formatMinutes(r.lateMinutes) }} кеш</p>
                  <p v-else-if="r.checkIn && r.schedule" class="text-xs text-green-600">уақытында</p>
                </td>
                <td class="px-4 py-3">
                  <p class="tabular-nums font-medium">{{ r.checkOut ? hhmm(r.checkOut) : r.checkIn ? '—' : '' }}</p>
                  <p v-if="r.earlyLeaveMinutes" class="text-xs text-orange-600">{{ formatMinutes(r.earlyLeaveMinutes) }} ерте</p>
                  <p v-else-if="r.overtimeMinutes" class="text-xs text-primary-600">+{{ formatMinutes(r.overtimeMinutes) }} үстеме</p>
                </td>
                <td class="px-4 py-3 tabular-nums">
                  <template v-if="r.checkIn">
                    {{ formatMinutes(r.workedMinutes) }}
                    <p v-if="!r.checkOut" class="text-xs text-gray-400">әлі жұмыста</p>
                  </template>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="badge" :class="STATUS[r.status].cls">{{ statusText(r) }}</span>
                  <span v-if="r.edited" class="ml-1 text-xs text-gray-400" title="Қолмен түзетілген">✎</span>
                </td>
                <td v-if="canEdit" class="px-4 py-3 text-right">
                  <button v-if="r.status !== 'leave'" class="text-primary-600 hover:underline text-sm" @click="openEditor(r.employeeId, r.employeeName, todayData.date, r.id ? r : null)">
                    {{ r.id ? 'Түзету' : 'Белгі қою' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Mobile: карточкалар -->
          <ul v-if="visibleToday.length" class="md:hidden divide-y divide-gray-100">
            <li v-for="r in visibleToday" :key="r.employeeId" class="px-4 py-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-medium text-gray-900 truncate">{{ r.employeeName }}</p>
                  <p class="text-xs text-gray-500">
                    <template v-if="r.schedule && r.isWorkDay">кесте {{ r.schedule.start }}–{{ r.schedule.end }}</template>
                    <template v-else-if="!r.isWorkDay">демалыс күні</template>
                  </p>
                </div>
                <span class="badge shrink-0" :class="STATUS[r.status].cls">{{ statusText(r) }}</span>
              </div>
              <div v-if="r.checkIn" class="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div><p class="text-xs text-gray-400">Келді</p><p class="tabular-nums font-medium">{{ hhmm(r.checkIn) }}</p></div>
                <div><p class="text-xs text-gray-400">Кетті</p><p class="tabular-nums font-medium">{{ r.checkOut ? hhmm(r.checkOut) : '—' }}</p></div>
                <div><p class="text-xs text-gray-400">Жұмыс</p><p class="tabular-nums font-medium">{{ formatMinutes(r.workedMinutes) }}</p></div>
              </div>
              <p v-if="r.lateMinutes || r.earlyLeaveMinutes || r.overtimeMinutes" class="mt-1 text-xs">
                <span v-if="r.lateMinutes" class="text-orange-600">{{ formatMinutes(r.lateMinutes) }} кеш келді. </span>
                <span v-if="r.earlyLeaveMinutes" class="text-orange-600">{{ formatMinutes(r.earlyLeaveMinutes) }} ерте кетті. </span>
                <span v-if="r.overtimeMinutes" class="text-primary-600">+{{ formatMinutes(r.overtimeMinutes) }} үстеме.</span>
              </p>
              <button v-if="canEdit && r.status !== 'leave'" class="mt-2 text-primary-600 text-sm" @click="openEditor(r.employeeId, r.employeeName, todayData.date, r.id ? r : null)">
                {{ r.id ? 'Түзету' : 'Белгі қою' }}
              </button>
            </li>
          </ul>
        </div>
      </template>
    </template>

    <!-- ==================== Айлық ==================== -->
    <div v-if="activeTab === 'monthly'" class="card !p-4 sm:!p-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div class="flex items-center gap-2">
          <button class="btn-secondary !px-3" aria-label="Алдыңғы ай" @click="shiftMonth(-1)">‹</button>
          <span class="min-w-[9rem] text-center font-semibold text-navy">{{ monthLabel }}</span>
          <button class="btn-secondary !px-3" aria-label="Келесі ай" @click="shiftMonth(1)">›</button>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary text-sm" @click="exportCSV">CSV</button>
          <button class="btn-primary text-sm" @click="exportExcel">Excel</button>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
        <span class="flex items-center gap-1"><i class="w-3 h-3 rounded bg-green-100 border border-green-300" />келді</span>
        <span class="flex items-center gap-1"><i class="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />кешікті</span>
        <span class="flex items-center gap-1"><i class="w-3 h-3 rounded bg-orange-100 border border-orange-300" />кетуі жоқ</span>
        <span class="flex items-center gap-1"><i class="w-3 h-3 rounded bg-red-100 border border-red-300" />келмеді</span>
        <span class="flex items-center gap-1"><i class="w-3 h-3 rounded bg-purple-100 border border-purple-300" />демалыс/ауру</span>
        <span class="flex items-center gap-1"><i class="w-3 h-3 rounded bg-gray-100 border border-gray-200" />демалыс күні/мереке</span>
      </div>

      <div v-if="loadingMonthly" class="text-center py-8 text-gray-400">Жүктелуде...</div>
      <div v-else-if="!month?.employees.length" class="text-center py-8 text-gray-400">Деректер жоқ</div>
      <template v-else>
        <h2 class="text-sm font-semibold text-navy mb-2">Ай қорытындысы</h2>
        <div class="overflow-x-auto -mx-4 sm:mx-0 mb-6">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th class="px-3 py-2 font-semibold">Қызметкер</th>
                <th class="px-3 py-2 font-semibold">Келген күн</th>
                <th class="px-3 py-2 font-semibold">Кешігу</th>
                <th class="px-3 py-2 font-semibold">Келмеген</th>
                <th class="px-3 py-2 font-semibold">Демалыс / ауру</th>
                <th class="px-3 py-2 font-semibold">Жұмыс уақыты</th>
                <th class="px-3 py-2 font-semibold">Үстеме</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="e in month.employees" :key="e.employeeId">
                <td class="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{{ e.employeeName }}</td>
                <td class="px-3 py-2.5 whitespace-nowrap tabular-nums">
                  <b>{{ e.daysPresent }}</b> <span class="text-gray-400">/ {{ e.plannedDays }} жоспар</span>
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap tabular-nums">
                  <template v-if="e.daysLate"><b class="text-orange-600">{{ e.daysLate }} рет</b> <span class="text-gray-500">· барлығы {{ formatMinutes(e.totalLateMinutes) }}</span></template>
                  <span v-else class="text-gray-300">—</span>
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap">
                  <b v-if="e.absentDays" class="text-red-600">{{ e.absentDays }} күн</b>
                  <span v-else class="text-gray-300">—</span>
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap">
                  <span v-if="e.leaveDayCount" class="text-purple-700">{{ e.leaveDayCount }} күн</span>
                  <span v-else class="text-gray-300">—</span>
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap tabular-nums"><b>{{ hoursText(e.totalWorkMinutes) }}</b></td>
                <td class="px-3 py-2.5 whitespace-nowrap tabular-nums">
                  <span v-if="e.totalOvertimeMinutes" class="text-primary-600">+{{ hoursText(e.totalOvertimeMinutes) }}</span>
                  <span v-else class="text-gray-300">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 class="text-sm font-semibold text-navy mb-2">Күндер бойынша</h2>
        <div class="overflow-x-auto -mx-4 sm:mx-0">
        <table class="text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              <th class="sticky left-0 z-10 bg-white text-left font-semibold text-gray-600 px-2 py-2 min-w-[9rem] border-b border-gray-200">Қызметкер</th>
              <th
                v-for="d in month.days" :key="d.date"
                class="px-0.5 py-1 font-medium border-b border-gray-200 min-w-[2.6rem]"
                :class="d.date === month.today ? 'text-white bg-primary-600 rounded-t' : d.holiday ? 'text-purple-600' : d.weekday >= 6 ? 'text-gray-400' : 'text-gray-600'"
                :title="d.holiday || ''"
              >
                <div>{{ Number(d.date.slice(8)) }}</div>
                <div class="font-normal">{{ WEEKDAYS_SHORT[d.weekday] }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in month.employees" :key="e.employeeId">
              <td class="sticky left-0 z-10 bg-white px-2 py-1 font-medium text-gray-800 border-b border-gray-100 whitespace-nowrap">{{ e.employeeName }}</td>
              <td v-for="d in month.days" :key="d.date" class="p-0.5 border-b border-gray-100">
                <button
                  type="button"
                  class="w-full h-9 rounded text-[11px] leading-tight border transition-colors"
                  :class="[cellClass(e, d), canEdit && d.date <= month.today ? 'hover:ring-2 hover:ring-primary-400 cursor-pointer' : 'cursor-default']"
                  :title="cellTitle(e, d)"
                  :disabled="!canEdit || d.date > month.today"
                  @click="openEditor(e.employeeId, e.employeeName, d.date, e.cells[d.date] || null)"
                >
                  <template v-if="e.cells[d.date]?.checkIn">
                    <div>{{ hhmm(e.cells[d.date].checkIn) }}</div>
                    <div class="opacity-70">{{ e.cells[d.date].checkOut ? hhmm(e.cells[d.date].checkOut) : '…' }}</div>
                  </template>
                  <template v-else-if="e.leaveDays[d.date]">{{ (LEAVE_LABELS[e.leaveDays[d.date]] || '').slice(0, 3) }}</template>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </template>
    </div>

    <!-- ==================== Түзету ==================== -->
    <AppModal :open="!!editor" :title="editor ? `${editor.employeeName} · ${formatDay(editor.date)}` : ''" @close="editor = null">
      <form v-if="editor" class="space-y-4" @submit.prevent="saveEditor">
        <p v-if="editor.recordId" class="text-sm text-gray-500">Белгіні түзету. Кешігу мен үстеме кесте бойынша қайта есептеледі.</p>
        <p v-else class="text-sm text-gray-500">Бұл күні белгі жоқ. Қолмен қосу (мысалы, киоск істемеді).</p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Келу</label>
            <input v-model="editor.checkIn" type="time" class="input" required />
          </div>
          <div>
            <label class="label">Кету</label>
            <input v-model="editor.checkOut" type="time" class="input" />
          </div>
        </div>
        <div>
          <label class="label">Себебі <span class="text-red-500">*</span></label>
          <input v-model="editor.note" class="input" placeholder="Мысалы: кетуді белгілеуді ұмытты" required minlength="3" maxlength="300" />
          <p class="text-xs text-gray-400 mt-1">Түзету жалақыға әсер етеді және журналға жазылады.</p>
        </div>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
          <button
            v-if="editor.recordId && isAdmin" type="button" class="btn-secondary !text-red-600"
            :disabled="savingEditor" @click="deleteRecord"
          >
            Жою
          </button>
          <span v-else />
          <div class="flex gap-2 justify-end">
            <button type="button" class="btn-secondary" @click="editor = null">Болдырмау</button>
            <button type="submit" class="btn-primary" :disabled="savingEditor">{{ savingEditor ? 'Сақталуда...' : 'Сақтау' }}</button>
          </div>
        </div>
      </form>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
const { notifyError, notifySuccess } = useNotify()
const { user, isAdmin } = useAuth()
const route = useRoute()
const canEdit = computed(() => user.value?.role === 'admin' || user.value?.role === 'head')

const activeTab = ref<'today' | 'monthly'>(route.query.tab === 'monthly' ? 'monthly' : 'today')

// ==================== Бүгін ====================

type TodayStatus = 'in_office' | 'left' | 'expected' | 'absent' | 'leave' | 'day_off'
interface TodayRow {
  employeeId: number
  employeeName: string
  departmentName: string | null
  schedule: { name: string; start: string; end: string } | null
  isWorkDay: boolean
  status: TodayStatus
  leaveType: string | null
  id: number | null
  checkIn: string | null
  checkOut: string | null
  lateMinutes: number
  overtimeMinutes: number
  earlyLeaveMinutes: number
  workedMinutes: number
  edited: boolean
}
interface TodayData {
  date: string
  now: string
  holiday: string | null
  rows: TodayRow[]
  stats: Record<string, number>
}

const STATUS: Record<TodayStatus, { label: string; cls: string; order: number }> = {
  absent: { label: 'Келмеді', cls: 'bg-red-100 text-red-700', order: 0 },
  in_office: { label: 'Кеңседе', cls: 'bg-green-100 text-green-700', order: 1 },
  left: { label: 'Кетті', cls: 'bg-gray-100 text-gray-700', order: 2 },
  expected: { label: 'Күтілуде', cls: 'bg-blue-50 text-blue-700', order: 3 },
  leave: { label: 'Демалыста', cls: 'bg-purple-100 text-purple-700', order: 4 },
  day_off: { label: 'Демалыс күні', cls: 'bg-gray-50 text-gray-400', order: 5 },
}
const statusText = (r: TodayRow) =>
  r.status === 'leave' ? (LEAVE_LABELS[r.leaveType || ''] || 'Демалыста')
    : r.status === 'expected' && r.schedule ? `${r.schedule.start}-де күтілуде`
      : STATUS[r.status].label

const loadingToday = ref(true)
const todayData = ref<TodayData | null>(null)
const today = computed(() => todayData.value?.date || '')
type TodayFilter = 'all' | 'in_office' | 'late' | 'absent' | 'left' | 'away'
const todayFilter = ref<TodayFilter>('all')
const todaySearch = ref('')

const todayFilters = computed(() => {
  const s = todayData.value?.stats || {}
  const list: { key: TodayFilter; label: string; count: number; tone: string }[] = [
    { key: 'all', label: 'Барлығы', count: s.total ?? 0, tone: 'text-navy' },
    { key: 'in_office', label: 'Қазір кеңседе', count: s.inOffice ?? 0, tone: 'text-green-600' },
    { key: 'late', label: 'Кешіккендер', count: s.late ?? 0, tone: 'text-orange-600' },
    { key: 'absent', label: 'Келмегендер', count: s.absent ?? 0, tone: 'text-red-600' },
    { key: 'left', label: 'Кеткендер', count: s.left ?? 0, tone: 'text-gray-700' },
    { key: 'away', label: 'Демалыс / күтілуде', count: (s.leave ?? 0) + (s.dayOff ?? 0) + (s.expected ?? 0), tone: 'text-purple-600' },
  ]
  return list
})

const visibleToday = computed(() => {
  const q = todaySearch.value.trim().toLowerCase()
  return (todayData.value?.rows || [])
    .filter((r) => {
      if (q && !r.employeeName.toLowerCase().includes(q)) return false
      switch (todayFilter.value) {
        case 'in_office': return r.status === 'in_office'
        case 'late': return r.lateMinutes > 0
        case 'absent': return r.status === 'absent'
        case 'left': return r.status === 'left'
        case 'away': return ['leave', 'day_off', 'expected'].includes(r.status)
        default: return true
      }
    })
    .sort((a, b) => STATUS[a.status].order - STATUS[b.status].order
      || (a.checkIn || '99').localeCompare(b.checkIn || '99')
      || a.employeeName.localeCompare(b.employeeName))
})

const fetchToday = async () => {
  loadingToday.value = true
  try {
    todayData.value = await $fetch<TodayData>('/api/attendance/today')
  } catch (e) {
    notifyError(e)
  } finally {
    loadingToday.value = false
  }
}

// ==================== Айлық ====================

interface MonthData {
  month: string
  today: string
  days: { date: string; weekday: number; holiday: string | null }[]
  employees: {
    employeeId: number
    employeeName: string
    startDate: string
    workDays: number[]
    plannedDays: number
    daysPresent: number
    daysLate: number
    absentDays: number
    totalWorkMinutes: number
    totalOvertimeMinutes: number
    totalLateMinutes: number
    cells: Record<string, { id: number; checkIn: string | null; checkOut: string | null; isLate: boolean; lateMinutes: number; overtimeMinutes: number }>
    leaveDays: Record<string, string>
    leaveDayCount: number
  }[]
}

const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const loadingMonthly = ref(false)
const monthLabel = computed(() => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
})
const month = ref<MonthData | null>(null)

const fetchMonthly = async () => {
  loadingMonthly.value = true
  try {
    const [year, m] = selectedMonth.value.split('-')
    month.value = await $fetch<MonthData>(`/api/attendance/month/${year}/${m}`)
  } catch (e) {
    notifyError(e)
  } finally {
    loadingMonthly.value = false
  }
}

const shiftMonth = (delta: number) => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  fetchMonthly()
}

type Emp = MonthData['employees'][number]
type Day = MonthData['days'][number]

/** 7530 мин -> "125,5 сағ" */
const hoursText = (min: number) => `${(Math.round(min / 6) / 10).toString().replace('.', ',')} сағ`

const isWorkDay = (e: Emp, d: Day) => e.workDays.includes(d.weekday) && !d.holiday

const cellClass = (e: Emp, d: Day) => {
  const c = e.cells[d.date]
  if (c?.checkIn) {
    if (!c.checkOut && d.date < (month.value?.today || '')) return 'bg-orange-100 border-orange-300 text-orange-800'
    return c.isLate ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-green-100 border-green-300 text-green-800'
  }
  if (e.leaveDays[d.date]) return 'bg-purple-100 border-purple-300 text-purple-700'
  if (!isWorkDay(e, d) || d.date < e.startDate) return 'bg-gray-50 border-gray-100 text-gray-300'
  if (d.date <= (month.value?.today || '')) return 'bg-red-50 border-red-200 text-red-400'
  return 'bg-white border-gray-100'
}

const cellTitle = (e: Emp, d: Day) => {
  const c = e.cells[d.date]
  const parts = [formatDay(d.date)]
  if (d.holiday) parts.push(d.holiday)
  if (c?.checkIn) {
    parts.push(`${hhmm(c.checkIn)}–${c.checkOut ? hhmm(c.checkOut) : '?'}`)
    if (c.isLate) parts.push(`${formatMinutes(c.lateMinutes)} кеш келді`)
    if (c.overtimeMinutes) parts.push(`+${formatMinutes(c.overtimeMinutes)} үстеме`)
  } else if (e.leaveDays[d.date]) parts.push(LEAVE_LABELS[e.leaveDays[d.date]] || '')
  else if (d.date < e.startDate) parts.push('әлі жұмыста емес')
  else if (!isWorkDay(e, d)) parts.push('демалыс күні')
  else if (d.date <= (month.value?.today || '')) parts.push('келмеді')
  return parts.join(' · ')
}

const exportCSV = () => {
  if (!month.value) return
  const headers = ['Қызметкер', 'Келген күн', 'Жоспар', 'Кешіккен', 'Келмеген', 'Жұмыс сағаты', 'Үстеме сағат']
  const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
  const rows = month.value.employees.map(e => [
    e.employeeName, e.daysPresent, e.plannedDays, e.daysLate, e.absentDays,
    (e.totalWorkMinutes / 60).toFixed(1), (e.totalOvertimeMinutes / 60).toFixed(1),
  ].map(esc).join(','))
  const blob = new Blob(['﻿' + [headers.map(esc).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tabel_${selectedMonth.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const exportExcel = () => {
  const [year, m] = selectedMonth.value.split('-')
  window.open(`/api/attendance/export-excel?year=${year}&month=${m}`, '_blank')
}

// ==================== Түзету ====================

const editor = ref<{
  employeeId: number
  employeeName: string
  date: string
  recordId: number | null
  checkIn: string
  checkOut: string
  note: string
} | null>(null)
const savingEditor = ref(false)

const openEditor = (employeeId: number, employeeName: string, date: string, record: { id: number | null; checkIn: string | null; checkOut: string | null } | null) => {
  if (!canEdit.value || !date) return
  editor.value = {
    employeeId,
    employeeName,
    date,
    recordId: record?.id ?? null,
    checkIn: record?.checkIn?.slice(0, 5) || '',
    checkOut: record?.checkOut?.slice(0, 5) || '',
    note: '',
  }
}

const reloadAll = async () => {
  await Promise.all([fetchToday(), activeTab.value === 'monthly' || month.value ? fetchMonthly() : Promise.resolve()])
}

const saveEditor = async () => {
  if (!editor.value) return
  savingEditor.value = true
  const { employeeId, date, recordId, checkIn, checkOut, note } = editor.value
  try {
    if (recordId) {
      await $fetch(`/api/attendance/${recordId}`, { method: 'PUT', body: { checkIn, checkOut: checkOut || null, note } })
    } else {
      await $fetch('/api/attendance/manual', { method: 'POST', body: { employeeId, date, checkIn, checkOut: checkOut || null, note } })
    }
    notifySuccess('Сақталды')
    editor.value = null
    await reloadAll()
  } catch (e) {
    notifyError(e)
  } finally {
    savingEditor.value = false
  }
}

const deleteRecord = async () => {
  if (!editor.value?.recordId) return
  if (editor.value.note.trim().length < 3) {
    notifyError({ message: 'Жою себебін жазыңыз' })
    return
  }
  savingEditor.value = true
  try {
    await $fetch(`/api/attendance/${editor.value.recordId}`, { method: 'DELETE', body: { note: editor.value.note } })
    notifySuccess('Жойылды')
    editor.value = null
    await reloadAll()
  } catch (e) {
    notifyError(e)
  } finally {
    savingEditor.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'monthly' && !month.value) fetchMonthly()
})

onMounted(() => {
  fetchToday()
  if (activeTab.value === 'monthly') fetchMonthly()
})
</script>
