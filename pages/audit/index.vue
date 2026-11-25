<template>
  <div class="page !max-w-5xl">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="page-title">Әрекеттер журналы</h1>
        <p class="page-subtitle">Кім, қашан және не өзгертті</p>
      </div>
      <select v-model="filter" class="input w-auto" @change="load(true)">
        <option value="">Барлығы</option>
        <option v-for="(label, key) in groups" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="card !p-0 overflow-hidden">
      <div v-if="loading && !rows.length" class="text-center py-8 text-gray-400">Жүктелуде...</div>
      <div v-else-if="!rows.length" class="text-center py-8 text-gray-400">Жазба жоқ</div>
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="r in rows" :key="r.id" class="px-5 py-3 text-sm">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p>
              <span class="font-medium" :class="actionColor(r.action)">{{ actionLabel(r.action) }}</span>
              <span class="text-gray-500"> · {{ r.userName || (r.action.startsWith('check') ? 'киоск' : 'жүйе') }}</span>
            </p>
            <span class="text-xs text-gray-400 whitespace-nowrap">{{ formatTs(r.createdAt) }}</span>
          </div>
          <p v-if="describe(r)" class="text-xs text-gray-500 mt-0.5 break-words">{{ describe(r) }}</p>
        </li>
      </ul>
      <div v-if="hasMore" class="p-4 text-center border-t border-gray-100">
        <button class="btn-secondary text-sm" :disabled="loading" @click="load(false)">Тағы көрсету</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [() => { if (useAuth().user.value?.role !== 'admin') return navigateTo('/') }] })

interface Row { id: number; action: string; details: any; createdAt: string; userName: string | null; userLogin: string | null }

const { notifyError } = useNotify()

const LABELS: Record<string, string> = {
  login: 'Жүйеге кірді',
  login_failed: 'Сәтсіз кіру',
  password_changed: 'Құпия сөзін ауыстырды',
  password_reset_cli: 'Құпия сөз қалпына келтірілді (CLI)',
  checkin: 'Келу белгісі',
  checkout: 'Кету белгісі',
  checkin_rejected: 'Бет танылмады',
  attendance_corrected: 'Белгі түзетілді',
  attendance_manual_created: 'Белгі қолмен қосылды',
  attendance_deleted: 'Белгі жойылды',
  employee_created: 'Қызметкер қосылды',
  employee_updated: 'Қызметкер өзгертілді',
  employee_deactivated: 'Қызметкер өшірілді',
  leave_requested: 'Демалысқа өтінім',
  leave_approved: 'Демалыс бекітілді',
  leave_rejected: 'Демалыс қабылданбады',
  payroll_calculated: 'Жалақы есептелді',
  kiosk_activated: 'Киоск тіркелді',
  kiosk_updated: 'Киоск өзгертілді',
  kiosk_revoked: 'Киоск бұғатталды',
  user_created: 'Пайдаланушы қосылды',
  user_updated: 'Пайдаланушы өзгертілді',
  user_password_reset: 'Құпия сөз қалпына келтірілді',
  holiday_saved: 'Мереке қосылды',
  holiday_removed: 'Мереке жойылды',
  holidays_seeded: 'Мерекелер күнтізбесі толтырылды',
}
const groups: Record<string, string> = {
  login: 'Кірулер', check: 'Белгілер (киоск)', attendance: 'Табель түзетулері', employee: 'Қызметкерлер',
  leave: 'Демалыстар', payroll: 'Жалақы', kiosk: 'Киосктер', user: 'Пайдаланушылар',
}

const actionLabel = (a: string) => LABELS[a] || a
const actionColor = (a: string) =>
  a.includes('failed') || a.includes('rejected') || a.includes('deleted') || a.includes('revoked') ? 'text-red-600'
    : a.startsWith('attendance') ? 'text-orange-600' : 'text-gray-900'

const formatTs = (ts: string) => {
  const d = new Date(ts.includes('T') || ts.includes('+') ? ts : `${ts.replace(' ', 'T')}Z`)
  return Number.isNaN(d.getTime()) ? ts : dateTimeText(d)
}

const describe = (r: Row) => {
  const d = r.details
  if (!d || typeof d !== 'object') return typeof d === 'string' ? d : ''
  const parts: string[] = []
  if (d.date) parts.push(d.date)
  if (d.before && d.after) parts.push(`${d.before.checkIn ?? '—'}–${d.before.checkOut ?? '—'} → ${d.after.checkIn ?? '—'}–${d.after.checkOut ?? '—'}`)
  if (d.note) parts.push(`себебі: ${d.note}`)
  if (d.reason) parts.push(d.reason === 'ambiguous' ? 'сенімсіз сәйкестік' : d.reason === 'no_match' ? 'тіркелмеген бет' : d.reason)
  if (d.login && r.action === 'login_failed') parts.push(`логин: ${d.login}`)
  if (d.period) parts.push(d.period)
  if (d.mode) parts.push(`режим: ${d.mode}`)
  if (d.name && !d.note) parts.push(d.name)
  return parts.join(' · ')
}

const rows = ref<Row[]>([])
const filter = ref('')
const loading = ref(false)
const hasMore = ref(false)
const PAGE = 100

const load = async (reset: boolean) => {
  loading.value = true
  try {
    const data = await $fetch<Row[]>('/api/audit', {
      query: { limit: PAGE, offset: reset ? 0 : rows.value.length, action: filter.value || undefined },
    })
    rows.value = reset ? data : [...rows.value, ...data]
    hasMore.value = data.length === PAGE
  } catch (e) {
    notifyError(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => load(true))
</script>
