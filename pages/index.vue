<template>
  <div class="page space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
      <div>
        <h1 class="page-title">Басты бет</h1>
        <p class="page-subtitle flex items-center gap-2">
          {{ data ? formatDay(data.date) : '' }}<span v-if="data">· {{ data.time }}</span>
          <span v-if="data?.stats.holiday" class="badge bg-purple-100 text-purple-700">{{ data.stats.holiday }}</span>
        </p>
      </div>
      <button class="btn-secondary self-start sm:self-auto" @click="refresh()">
        <AppIcon name="refresh" :size="16" />Жаңарту
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      <div v-for="s in statCards" :key="s.label" class="relative overflow-hidden rounded-xl p-4 sm:p-5 text-white shadow-card" :class="[s.bg, s.wide ? 'col-span-2 lg:col-span-1' : '']">
        <AppIcon :name="s.icon" :size="56" :stroke="1.25" class="absolute -right-2 -bottom-2 opacity-20" />
        <p class="text-sm font-medium text-white/85">{{ s.label }}</p>
        <p class="mt-2 text-3xl font-semibold tracking-tight">{{ s.value }}</p>
      </div>
    </div>

    <!-- Open shifts warning -->
    <div v-if="data?.openShifts.length" class="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-semibold text-orange-800">Аяқталмаған ауысымдар: {{ data.openShifts.length }}</p>
          <p class="text-sm text-orange-700 mt-0.5">Бұл қызметкерлер кетуді белгілемеген — жұмыс сағаты мен жалақы есептелмейді.</p>
        </div>
        <NuxtLink v-if="canEdit" to="/attendance?tab=monthly" class="btn-primary text-sm whitespace-nowrap">Түзету</NuxtLink>
      </div>
      <ul class="mt-3 flex flex-wrap gap-2">
        <li v-for="s in data.openShifts.slice(0, 12)" :key="s.id" class="text-xs px-2 py-1 rounded-lg bg-white border border-orange-200 text-orange-800">
          {{ s.name }} · {{ formatDay(s.date) }} · {{ hhmm(s.checkIn) }}
        </li>
      </ul>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- In office -->
      <div class="card lg:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-navy">Қазір кеңседе</h2>
          <NuxtLink to="/scan" class="text-sm font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">Сканерлеу<AppIcon name="chevron-right" :size="16" /></NuxtLink>
        </div>
        <div v-if="pending && !data" class="text-center py-8 text-gray-400">Жүктелуде...</div>
        <div v-else-if="!data?.inOffice.length" class="text-center py-8 text-gray-400">Кеңседе ешкім жоқ</div>
        <ul v-else class="divide-y divide-gray-100">
          <li v-for="p in data.inOffice" :key="p.employeeId" class="flex items-center justify-between py-2.5">
            <div class="flex items-center gap-3">
              <span class="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-semibold">{{ p.name?.charAt(0) }}</span>
              <div>
                <p class="font-medium text-sm">{{ p.name }}</p>
                <p class="text-xs text-gray-400">келді {{ hhmm(p.checkIn) }}</p>
              </div>
            </div>
            <span v-if="p.isLate" class="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full whitespace-nowrap">{{ formatMinutes(p.lateMinutes) }} кеш</span>
          </li>
        </ul>
        <div v-if="data?.left.length" class="mt-4 pt-4 border-t border-gray-100">
          <p class="text-xs font-medium text-gray-500 mb-2">Кетті</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="p in data.left" :key="p.employeeId" class="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
              {{ p.name }} · {{ hhmm(p.checkIn) }}–{{ hhmm(p.checkOut) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Side lists -->
      <div class="space-y-6">
        <div class="card">
          <h2 class="text-base font-semibold text-navy mb-3">Әлі келмегендер</h2>
          <p v-if="!data?.notArrived.length" class="text-sm text-gray-400">Барлығы келді</p>
          <ul v-else class="space-y-1.5">
            <li v-for="p in data.notArrived" :key="p.employeeId" class="text-sm text-gray-700 flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-red-400" />{{ p.name }}
            </li>
          </ul>
        </div>
        <div v-if="data?.late.length" class="card">
          <h2 class="text-base font-semibold text-navy mb-3">Кешіккендер</h2>
          <ul class="space-y-1.5">
            <li v-for="p in data.late" :key="p.employeeId" class="text-sm flex justify-between">
              <span>{{ p.name }}</span><span class="text-orange-600 whitespace-nowrap">{{ hhmm(p.checkIn) }} · {{ formatMinutes(p.lateMinutes) }} кеш</span>
            </li>
          </ul>
        </div>
        <div v-if="data?.leaveToday.length" class="card">
          <h2 class="text-base font-semibold text-navy mb-3">Демалыста</h2>
          <ul class="space-y-1.5">
            <li v-for="p in data.leaveToday" :key="p.employeeId" class="text-sm flex justify-between">
              <span>{{ p.name }}</span><span class="text-purple-600">{{ LEAVE_LABELS[p.type] || p.type }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Week -->
    <div class="card">
      <h2 class="text-base font-semibold text-navy mb-4">Соңғы 7 күн</h2>
      <div class="grid grid-cols-7 gap-2 items-end h-40">
        <div v-for="d in data?.week || []" :key="d.date" class="flex flex-col items-center gap-1 h-full justify-end">
          <span class="text-xs font-medium text-gray-700">{{ d.planned ? `${d.present}/${d.planned}` : (d.present || '') }}</span>
          <div class="w-full max-w-[3rem] rounded-t-md bg-gray-100 relative flex-1 flex items-end overflow-hidden">
            <div
              class="w-full rounded-t-md transition-all"
              :class="d.planned && d.present / d.planned < 0.8 ? 'bg-status-warn' : 'bg-primary-600'"
              :style="{ height: barHeight(d) }"
            />
          </div>
          <span class="text-xs" :class="d.holiday || !d.planned ? 'text-purple-500' : 'text-gray-500'" :title="d.holiday || ''">
            {{ WEEKDAYS_SHORT[d.weekday] }} {{ Number(d.date.slice(8)) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user } = useAuth()
const canEdit = computed(() => user.value?.role === 'admin' || user.value?.role === 'head')

interface Dashboard {
  date: string
  time: string
  stats: { total: number; present: number; inOffice: number; late: number; onLeave: number; notArrived: number; holiday: string | null }
  inOffice: { employeeId: number; name: string; checkIn: string; isLate: boolean; lateMinutes: number }[]
  left: { employeeId: number; name: string; checkIn: string; checkOut: string }[]
  late: { employeeId: number; name: string; checkIn: string; lateMinutes: number }[]
  leaveToday: { employeeId: number; name: string; type: string }[]
  notArrived: { employeeId: number; name: string }[]
  openShifts: { id: number; employeeId: number; name: string; date: string; checkIn: string }[]
  week: { date: string; weekday: number; holiday: string | null; planned: number; present: number }[]
}

const { data, pending, refresh } = await useFetch<Dashboard>('/api/dashboard')

// Фирмалық градиенттер (--gradient-*)
const statCards = computed(() => {
  const st = data.value?.stats
  const v = (n?: number) => (n ?? '–')
  return [
    { label: 'Қазір кеңседе', value: v(st?.inOffice), icon: 'door-open', bg: 'bg-grad-green' },
    { label: 'Бүгін келді', value: st ? `${st.present}/${st.total}` : '–', icon: 'user-check', bg: 'bg-grad-blue' },
    { label: 'Кешікті', value: v(st?.late), icon: 'timer', bg: 'bg-grad-orange' },
    { label: 'Әлі келмеді', value: v(st?.notArrived), icon: 'user-x', bg: 'bg-grad-dark' },
    { label: 'Демалыста / ауру', value: v(st?.onLeave), icon: 'plane', bg: 'bg-grad-purple', wide: true },
  ]
})

const maxWeek = computed(() => Math.max(1, ...(data.value?.week || []).map(d => Math.max(d.planned, d.present))))
const barHeight = (d: Dashboard['week'][number]) => `${Math.round((d.present / maxWeek.value) * 100)}%`

// Бет ашық тұрғанда әр минут сайын жаңартамыз (кеңседегілер тізімі өзгереді)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => refresh(), 60_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>
