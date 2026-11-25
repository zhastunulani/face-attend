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
    <div v-if="activeTab === 'today'" class="card">
      <div v-if="loadingToday" class="text-center py-8 text-gray-400">Жүктелуде...</div>
      <div v-else-if="!todayRows.length" class="text-center py-8 text-gray-400">Деректер жоқ</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-left text-gray-600">
              <th class="pb-3 font-semibold">Қызметкер</th>
              <th class="pb-3 font-semibold">Келу</th>
              <th class="pb-3 font-semibold">Кету</th>
              <th class="pb-3 font-semibold">Статус</th>
              <th v-if="canEdit" class="pb-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in todayRows" :key="r.key" class="border-b border-gray-100 hover:bg-gray-50">
              <td class="py-3 font-medium">{{ r.employeeName }}</td>
              <td class="py-3">{{ hhmm(r.checkIn) }}</td>
              <td class="py-3">{{ hhmm(r.checkOut) }}</td>
              <td class="py-3">
                <span v-if="!r.checkIn" class="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Келмеді</span>
                <span v-else-if="r.isLate" class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">Кешікті {{ r.lateMinutes }} мин</span>
                <span v-else class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Уақытында</span>
                <span v-if="r.checkIn && !r.checkOut" class="ml-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">кеңседе</span>
              </td>
              <td v-if="canEdit" class="py-3 text-right">
                <button class="text-primary-600 hover:underline text-sm" @click="openEditor(r.employeeId, r.employeeName, today, r.id ? r : null)">
                  {{ r.id ? 'Түзету' : 'Белгі қою' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==================== Айлық ==================== -->
    <div v-if="activeTab === 'monthly'" class="card !p-4 sm:!p-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div class="flex items-center gap-2">
          <button class="btn-secondary !px-3" aria-label="Алдыңғы ай" @click="shiftMonth(-1)">‹</button>
          <input v-model="selectedMonth" type="month" class="input w-auto" @change="fetchMonthly" />
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
      <div v-else class="overflow-x-auto -mx-4 sm:mx-0">
        <table class="text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              <th class="sticky left-0 z-10 bg-white text-left font-semibold text-gray-600 px-2 py-2 min-w-[9rem] border-b border-gray-200">Қызметкер</th>
              <th
                v-for="d in month.days" :key="d.date"
                class="px-0.5 py-1 font-medium border-b border-gray-200 min-w-[2.6rem]"
                :class="d.holiday ? 'text-purple-600' : d.weekday >= 6 ? 'text-gray-400' : 'text-gray-600'"
                :title="d.holiday || ''"
              >
                <div>{{ Number(d.date.slice(8)) }}</div>
                <div class="font-normal">{{ WEEKDAYS_SHORT[d.weekday] }}</div>
              </th>
              <th class="px-2 py-2 font-semibold text-gray-600 border-b border-gray-200" title="Келген / жоспар">Келді</th>
              <th class="px-2 py-2 font-semibold text-gray-600 border-b border-gray-200">Кеш.</th>
              <th class="px-2 py-2 font-semibold text-gray-600 border-b border-gray-200">Жоқ</th>
              <th class="px-2 py-2 font-semibold text-gray-600 border-b border-gray-200">Сағ.</th>
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
              <td class="px-2 text-center border-b border-gray-100 whitespace-nowrap">{{ e.daysPresent }}/{{ e.plannedDays }}</td>
              <td class="px-2 text-center border-b border-gray-100" :class="e.daysLate ? 'text-yellow-600 font-semibold' : ''">{{ e.daysLate }}</td>
              <td class="px-2 text-center border-b border-gray-100" :class="e.absentDays ? 'text-red-600 font-semibold' : ''">{{ e.absentDays }}</td>
              <td class="px-2 text-center border-b border-gray-100">{{ (e.totalWorkMinutes / 60).toFixed(1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
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

const loadingToday = ref(true)
const today = ref('')
const todayRows = ref<any[]>([])

const fetchToday = async () => {
  loadingToday.value = true
  try {
    const data = await $fetch<any>('/api/attendance/today')
    today.value = data.date
    todayRows.value = [
      ...data.present.map((r: any) => ({ ...r, key: `p${r.id}` })),
      ...data.absent.map((e: any) => ({ key: `a${e.id}`, employeeId: e.id, employeeName: e.name })),
    ]
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
    workDays: number[]
    plannedDays: number
    daysPresent: number
    daysLate: number
    absentDays: number
    totalWorkMinutes: number
    totalOvertimeMinutes: number
    cells: Record<string, { id: number; checkIn: string | null; checkOut: string | null; isLate: boolean; lateMinutes: number; overtimeMinutes: number }>
    leaveDays: Record<string, string>
  }[]
}

const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const loadingMonthly = ref(false)
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

const isWorkDay = (e: Emp, d: Day) => e.workDays.includes(d.weekday) && !d.holiday

const cellClass = (e: Emp, d: Day) => {
  const c = e.cells[d.date]
  if (c?.checkIn) {
    if (!c.checkOut && d.date < (month.value?.today || '')) return 'bg-orange-100 border-orange-300 text-orange-800'
    return c.isLate ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-green-100 border-green-300 text-green-800'
  }
  if (e.leaveDays[d.date]) return 'bg-purple-100 border-purple-300 text-purple-700'
  if (!isWorkDay(e, d)) return 'bg-gray-50 border-gray-100 text-gray-300'
  if (d.date <= (month.value?.today || '')) return 'bg-red-50 border-red-200 text-red-400'
  return 'bg-white border-gray-100'
}

const cellTitle = (e: Emp, d: Day) => {
  const c = e.cells[d.date]
  const parts = [formatDay(d.date)]
  if (d.holiday) parts.push(d.holiday)
  if (c?.checkIn) {
    parts.push(`${hhmm(c.checkIn)}–${c.checkOut ? hhmm(c.checkOut) : '?'}`)
    if (c.isLate) parts.push(`кешікті ${c.lateMinutes} мин`)
    if (c.overtimeMinutes) parts.push(`үстеме ${c.overtimeMinutes} мин`)
  } else if (e.leaveDays[d.date]) parts.push(LEAVE_LABELS[e.leaveDays[d.date]] || '')
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

const openEditor = (employeeId: number, employeeName: string, date: string, record: { id: number; checkIn: string | null; checkOut: string | null } | null) => {
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
