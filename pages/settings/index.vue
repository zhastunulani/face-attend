<template>
  <div class="page !max-w-4xl">
    <div class="mb-6">
      <h1 class="page-title">Баптаулар</h1>
      <p class="page-subtitle">Жүйе параметрлерін басқару</p>
    </div>

    <!-- User info -->
    <div class="card mb-6">
      <h2 class="text-lg font-semibold mb-4">Пайдаланушы</h2>
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary-600">
          {{ userInfo?.name?.charAt(0) || '?' }}
        </div>
        <div>
          <p class="font-semibold text-lg">{{ userInfo?.name || '-' }}</p>
          <p class="text-gray-500 text-sm">{{ userInfo?.login || '-' }}</p>
          <p class="text-gray-400 text-xs mt-0.5">Рөлі: {{ userInfo?.role || '-' }}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6" :class="isAdmin ? 'md:grid-cols-2' : 'max-w-md'">
      <!-- Salary settings -->
      <div v-if="isAdmin" class="card">
        <h2 class="text-lg font-semibold mb-4">Жалақы параметрлері</h2>
        <div v-if="loadingSalary" class="text-center py-4 text-gray-400">Жүктелуде...</div>
        <form v-else @submit.prevent="saveSalarySettings" class="space-y-4">
          <div>
            <label class="label">Үстеме коэффициенті</label>
            <input v-model.number="salarySettings.overtimeCoefficient" type="number" step="0.1" min="1" class="input" required />
          </div>
          <div>
            <label class="label">Демалыс күн коэффициенті</label>
            <input v-model.number="salarySettings.weekendCoefficient" type="number" step="0.1" min="1" class="input" required />
          </div>
          <div>
            <label class="label">Стандарт жұмыс сағаты (күніне)</label>
            <input v-model.number="salarySettings.standardHoursPerDay" type="number" min="1" max="24" class="input" required />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="savingSalary">
            {{ savingSalary ? 'Сақталуда...' : 'Сақтау' }}
          </button>
          <p v-if="salarySuccess" class="text-green-600 text-sm text-center">Сәтті сақталды!</p>
        </form>
      </div>

      <!-- Change password -->
      <div class="card">
        <h2 class="text-lg font-semibold mb-4">Құпия сөзді өзгерту</h2>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="label">Ағымдағы құпия сөз</label>
            <input v-model="passwordForm.oldPassword" type="password" class="input" placeholder="••••••••" required />
          </div>
          <div>
            <label class="label">Жаңа құпия сөз</label>
            <input v-model="passwordForm.newPassword" type="password" class="input" placeholder="••••••••" required />
          </div>
          <div>
            <label class="label">Жаңа құпия сөзді растау</label>
            <input v-model="passwordForm.confirmPassword" type="password" class="input" placeholder="••••••••" required />
          </div>
          <p v-if="passwordError" class="text-red-500 text-sm">{{ passwordError }}</p>
          <p v-if="passwordSuccess" class="text-green-600 text-sm">Құпия сөз сәтті өзгертілді!</p>
          <button type="submit" class="btn-primary w-full" :disabled="savingPassword">
            {{ savingPassword ? 'Өзгертілуде...' : 'Өзгерту' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Kiosks -->
    <div v-if="isAdmin" class="card mt-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Киоск құрылғылары</h2>
        <NuxtLink to="/scan" class="text-sm text-primary-600 hover:underline">Осы құрылғыны тіркеу →</NuxtLink>
      </div>
      <p class="text-sm text-gray-500 mb-3">Сканерлеу тек осы тізімдегі белсенді құрылғылардан мүмкін. Құрылғы жоғалса — бұғаттаңыз.</p>
      <div v-if="!kiosks.length" class="text-sm text-gray-400">Тіркелген киоск жоқ</div>
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="k in kiosks" :key="k.id" class="py-2 flex items-center justify-between gap-3 text-sm">
          <div>
            <p class="font-medium" :class="k.isRevoked ? 'text-gray-400 line-through' : 'text-gray-900'">{{ k.name }} <span class="text-gray-400">#{{ k.id }}</span></p>
            <p class="text-xs text-gray-400">Соңғы белсенділік: {{ k.lastSeenAt ? dateTimeText(new Date(k.lastSeenAt)) : '—' }}</p>
          </div>
          <div v-if="!k.isRevoked" class="flex items-center gap-3">
            <select :value="k.mode" class="input w-36 py-1 text-sm" @change="setKioskMode(k.id, ($event.target as HTMLSelectElement).value)">
              <option value="auto">Бір есік (авто)</option>
              <option value="in">Тек кіру</option>
              <option value="out">Тек шығу</option>
            </select>
            <button class="text-red-500 hover:text-red-700 font-medium" @click="revokeKiosk(k.id)">Бұғаттау</button>
          </div>
          <span v-else class="text-xs text-gray-400">Бұғатталған</span>
        </li>
      </ul>
    </div>

    <!-- Holidays -->
    <div v-if="isAdmin" class="card mt-6">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-semibold">Мерекелер</h2>
        <div class="flex items-center gap-1">
          <button class="btn-secondary !px-3 !py-1" aria-label="Алдыңғы жыл" @click="holidayYear--; fetchHolidays()">‹</button>
          <span class="font-medium w-14 text-center">{{ holidayYear }}</span>
          <button class="btn-secondary !px-3 !py-1" aria-label="Келесі жыл" @click="holidayYear++; fetchHolidays()">›</button>
        </div>
      </div>
      <p class="text-sm text-gray-500 mb-4">
        Мереке күндері жоспарлы жұмыс күніне кірмейді, ал бұл күнгі жұмыс демалыс коэффициентімен төленеді.
        Құрбан айт пен Үкімет қаулысымен ауыстырылған демалыс күндерін қолмен қосыңыз.
      </p>
      <form class="flex flex-col sm:flex-row gap-2 mb-4" @submit.prevent="addHoliday">
        <input v-model="newHoliday.date" type="date" class="input sm:w-44" required />
        <input v-model="newHoliday.name" class="input" placeholder="Атауы, мысалы: Құрбан айт" required maxlength="100" />
        <button type="submit" class="btn-primary whitespace-nowrap">Қосу</button>
      </form>
      <div v-if="!holidayList.length" class="text-sm text-gray-400">Бұл жылға мереке жоқ</div>
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="h in holidayList" :key="h.date" class="py-2 flex items-center justify-between text-sm">
          <span><span class="font-medium w-28 inline-block">{{ formatDay(h.date) }}</span> {{ h.name }}</span>
          <button class="text-gray-400 hover:text-red-600" aria-label="Жою" @click="removeHoliday(h.date)">×</button>
        </li>
      </ul>
    </div>

    <!-- Quick links -->
    <div v-if="isAdmin" class="card mt-6">
      <h2 class="text-lg font-semibold mb-4">Жылдам сілтемелер</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NuxtLink to="/users" class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
          <div class="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center"><AppIcon name="key" :size="20" /></div>
          <div>
            <p class="font-medium text-sm">Пайдаланушылар</p>
            <p class="text-xs text-gray-400">Кіру құқықтары</p>
          </div>
        </NuxtLink>
        <NuxtLink to="/audit" class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
          <div class="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center"><AppIcon name="list" :size="20" /></div>
          <div>
            <p class="font-medium text-sm">Журнал</p>
            <p class="text-xs text-gray-400">Кім не өзгертті</p>
          </div>
        </NuxtLink>
        <NuxtLink to="/departments" class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
          <div class="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center"><AppIcon name="building" :size="20" /></div>
          <div>
            <p class="font-medium text-sm">Бөлімдер</p>
            <p class="text-xs text-gray-400">Басқару</p>
          </div>
        </NuxtLink>
        <NuxtLink to="/positions" class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
          <div class="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center"><AppIcon name="briefcase" :size="20" /></div>
          <div>
            <p class="font-medium text-sm">Лауазымдар</p>
            <p class="text-xs text-gray-400">Басқару</p>
          </div>
        </NuxtLink>
        <NuxtLink to="/schedules" class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
          <div class="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center"><AppIcon name="clock" :size="20" /></div>
          <div>
            <p class="font-medium text-sm">Жұмыс кестелері</p>
            <p class="text-xs text-gray-400">Басқару</p>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, isAdmin } = useAuth()
const { notifyError } = useNotify()
const userInfo = ref<any>(null)
const loadingSalary = ref(true)
const savingSalary = ref(false)
const salarySuccess = ref(false)
const savingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref(false)

const salarySettings = reactive({
  overtimeCoefficient: 1.5,
  weekendCoefficient: 2.0,
  standardHoursPerDay: 8,
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const fetchUserInfo = async () => {
  try {
    userInfo.value = await $fetch<any>('/api/auth/me')
  } catch (e) {
    console.error(e)
  }
}

const fetchSalarySettings = async () => {
  loadingSalary.value = true
  try {
    const data = await $fetch<any>('/api/settings/salary')
    if (data) {
      salarySettings.overtimeCoefficient = data.overtimeCoefficient ?? 1.5
      salarySettings.weekendCoefficient = data.weekendCoefficient ?? 2.0
      salarySettings.standardHoursPerDay = data.standardHoursPerDay ?? 8
    }
  } catch (e) {
    console.error(e)
  } finally {
    loadingSalary.value = false
  }
}

const saveSalarySettings = async () => {
  savingSalary.value = true
  salarySuccess.value = false
  try {
    await $fetch('/api/settings/salary', {
      method: 'PUT',
      body: { ...salarySettings },
    })
    salarySuccess.value = true
    setTimeout(() => { salarySuccess.value = false }, 3000)
  } catch (e) {
    notifyError(e)
  } finally {
    savingSalary.value = false
  }
}

const changePassword = async () => {
  passwordError.value = ''
  passwordSuccess.value = false

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Жаңа құпия сөздер сәйкес келмейді'
    return
  }

  if (passwordForm.newPassword.length < 8) {
    passwordError.value = 'Құпия сөз кемінде 8 таңбадан тұруы керек'
    return
  }

  savingPassword.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      },
    })
    passwordSuccess.value = true
    if (user.value) user.value = { ...user.value, mustChangePassword: false }
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    setTimeout(() => { passwordSuccess.value = false }, 3000)
  } catch (e: any) {
    passwordError.value = e.data?.message || e.data?.statusMessage || 'Құпия сөзді өзгерту кезінде қате пайда болды'
  } finally {
    savingPassword.value = false
  }
}

const holidayYear = ref(new Date().getFullYear())
const holidayList = ref<{ date: string; name: string }[]>([])
const newHoliday = reactive({ date: '', name: '' })
const fetchHolidays = async () => {
  try {
    holidayList.value = await $fetch<{ date: string; name: string }[]>('/api/holidays', { query: { year: holidayYear.value } })
  } catch (e) {
    notifyError(e)
  }
}
const addHoliday = async () => {
  try {
    await $fetch('/api/holidays', { method: 'POST', body: { ...newHoliday } })
    holidayYear.value = Number(newHoliday.date.slice(0, 4))
    newHoliday.date = ''
    newHoliday.name = ''
    await fetchHolidays()
  } catch (e) {
    notifyError(e)
  }
}
const removeHoliday = async (date: string) => {
  try {
    await $fetch(`/api/holidays/${date}`, { method: 'DELETE' })
    await fetchHolidays()
  } catch (e) {
    notifyError(e)
  }
}

const kiosks = ref<any[]>([])
const fetchKiosks = async () => {
  try {
    kiosks.value = await $fetch<any[]>('/api/kiosk')
  } catch (e) {
    notifyError(e)
  }
}
const setKioskMode = async (id: number, mode: string) => {
  try {
    await $fetch(`/api/kiosk/${id}`, { method: 'PUT', body: { mode } })
    await fetchKiosks()
  } catch (e) {
    notifyError(e)
  }
}
const revokeKiosk = async (id: number) => {
  try {
    await $fetch(`/api/kiosk/${id}`, { method: 'DELETE' })
    await fetchKiosks()
  } catch (e) {
    notifyError(e)
  }
}

onMounted(() => {
  fetchUserInfo()
  if (isAdmin.value) {
    fetchSalarySettings()
    fetchKiosks()
    fetchHolidays()
  }
})
</script>
