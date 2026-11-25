<template>
  <div class="page !max-w-5xl">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="page-title">Пайдаланушылар</h1>
        <p class="page-subtitle">Жүйеге кіретін әкімшілер, бөлім басшылары және менеджерлер</p>
      </div>
      <button class="btn-primary self-start" @click="openCreate">+ Жаңа пайдаланушы</button>
    </div>

    <div class="card !p-0 overflow-hidden">
      <div v-if="loading" class="text-center py-8 text-gray-400">Жүктелуде...</div>
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="u in list" :key="u.id" class="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4" :class="!u.isActive ? 'opacity-60' : ''">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0" :class="roleStyle[u.role]">{{ u.name.charAt(0) }}</span>
            <div class="min-w-0">
              <p class="font-medium text-gray-900 truncate">
                {{ u.name }}
                <span v-if="u.id === me?.id" class="text-xs text-gray-400">(сіз)</span>
              </p>
              <p class="text-sm text-gray-500">
                {{ u.login }} · {{ roleLabel[u.role] }}<span v-if="u.departmentId"> · {{ deptName(u.departmentId) }}</span>
              </p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span v-if="!u.isActive" class="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">өшірілген</span>
            <span v-else-if="u.mustChangePassword" class="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">уақытша құпия сөз</span>
            <button class="text-primary-600 hover:underline text-sm" @click="openEdit(u)">Өзгерту</button>
            <button class="text-gray-600 hover:underline text-sm" @click="resetPassword(u)">Құпия сөзді қалпына келтіру</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Create / edit -->
    <AppModal :open="!!form" :title="form?.id ? 'Пайдаланушыны өзгерту' : 'Жаңа пайдаланушы'" @close="form = null">
      <form v-if="form" class="space-y-4" @submit.prevent="save">
        <div v-if="!form.id">
          <label class="label">Логин</label>
          <input v-model="form.login" class="input" placeholder="мысалы: aigerim" pattern="[a-zA-Z0-9._-]{3,32}" required autocomplete="off" />
        </div>
        <div>
          <label class="label">Аты-жөні</label>
          <input v-model="form.name" class="input" required maxlength="100" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Рөлі</label>
            <select v-model="form.role" class="input" :disabled="form.id === me?.id">
              <option value="head">Бөлім басшысы</option>
              <option value="manager">Менеджер</option>
              <option value="admin">Әкімші</option>
            </select>
          </div>
          <div>
            <label class="label">Бөлім</label>
            <select v-model="form.departmentId" class="input" :required="form.role === 'head'">
              <option :value="null">—</option>
              <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
        </div>
        <p class="text-xs text-gray-500">{{ roleHelp[form.role] }}</p>
        <label v-if="form.id && form.id !== me?.id" class="flex items-center gap-2 text-sm">
          <input v-model="form.isActive" type="checkbox" class="rounded" /> Белсенді (жүйеге кіре алады)
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="form = null">Болдырмау</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Сақталуда...' : 'Сақтау' }}</button>
        </div>
      </form>
    </AppModal>

    <!-- One-time password -->
    <AppModal :open="!!issued" title="Уақытша құпия сөз" @close="issued = null">
      <div v-if="issued" class="space-y-4">
        <p class="text-sm text-gray-600">
          Осы деректерді <b>{{ issued.login }}</b> пайдаланушысына беріңіз. Құпия сөз <b>тек қазір</b> көрсетіледі;
          бірінші кіруде жүйе оны ауыстыруды талап етеді.
        </p>
        <div class="rounded-xl bg-gray-50 border border-gray-200 p-4 font-mono text-sm space-y-1">
          <div>Сайт: {{ origin }}</div>
          <div>Логин: {{ issued.login }}</div>
          <div>Құпия сөз: <span class="font-bold">{{ issued.password }}</span></div>
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary" @click="copyIssued">{{ copied ? 'Көшірілді' : 'Көшіру' }}</button>
          <button class="btn-primary" @click="issued = null">Дайын</button>
        </div>
      </div>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [() => { if (useAuth().user.value?.role !== 'admin') return navigateTo('/') }] })

interface UserRow { id: number; login: string; name: string; role: 'admin' | 'head' | 'manager'; departmentId: number | null; isActive: boolean; mustChangePassword: boolean }

const { user: me } = useAuth()
const { notifyError, notifySuccess } = useNotify()

const roleLabel: Record<string, string> = { admin: 'Әкімші', head: 'Бөлім басшысы', manager: 'Менеджер' }
const roleStyle: Record<string, string> = {
  admin: 'bg-red-100 text-red-700', head: 'bg-blue-100 text-blue-700', manager: 'bg-green-100 text-green-700',
}
const roleHelp: Record<string, string> = {
  admin: 'Барлығына толық қолжетімділік: жалақы, баптаулар, пайдаланушылар.',
  head: 'Тек өз бөлімі: қызметкерлер, табельді түзету, демалыстарды бекіту.',
  manager: 'Табель мен қызметкерлерді көру, демалысқа өтінім (жалақысыз).',
}

const list = ref<UserRow[]>([])
const departments = ref<{ id: number; name: string }[]>([])
const loading = ref(true)
const deptName = (id: number) => departments.value.find(d => d.id === id)?.name ?? '—'

const load = async () => {
  loading.value = true
  try {
    ;[list.value, departments.value] = await Promise.all([
      $fetch<UserRow[]>('/api/users'),
      $fetch<{ id: number; name: string }[]>('/api/departments'),
    ])
  } catch (e) {
    notifyError(e)
  } finally {
    loading.value = false
  }
}

const form = ref<{ id?: number; login: string; name: string; role: UserRow['role']; departmentId: number | null; isActive: boolean } | null>(null)
const saving = ref(false)
const openCreate = () => { form.value = { login: '', name: '', role: 'head', departmentId: null, isActive: true } }
const openEdit = (u: UserRow) => { form.value = { id: u.id, login: u.login, name: u.name, role: u.role, departmentId: u.departmentId, isActive: u.isActive } }

const issued = ref<{ login: string; password: string } | null>(null)
const copied = ref(false)
const origin = import.meta.client ? window.location.origin : ''

const save = async () => {
  if (!form.value) return
  saving.value = true
  try {
    const { id, login, name, role, departmentId, isActive } = form.value
    if (id) {
      await $fetch(`/api/users/${id}`, { method: 'PUT', body: { name, role, departmentId, isActive } })
      notifySuccess('Сақталды')
    } else {
      const res = await $fetch<{ tempPassword: string; user: UserRow }>('/api/users', { method: 'POST', body: { login, name, role, departmentId } })
      issued.value = { login: res.user.login, password: res.tempPassword }
      copied.value = false
    }
    form.value = null
    await load()
  } catch (e) {
    notifyError(e)
  } finally {
    saving.value = false
  }
}

const resetPassword = async (u: UserRow) => {
  try {
    const res = await $fetch<{ login: string; tempPassword: string }>(`/api/users/${u.id}/reset-password`, { method: 'POST' })
    issued.value = { login: res.login, password: res.tempPassword }
    copied.value = false
    await load()
  } catch (e) {
    notifyError(e)
  }
}

const copyIssued = async () => {
  if (!issued.value) return
  try {
    await navigator.clipboard.writeText(`Сайт: ${origin}\nЛогин: ${issued.value.login}\nҚұпия сөз: ${issued.value.password}`)
    copied.value = true
  } catch {
    notifyError({ message: 'Көшіру мүмкін болмады — қолмен белгілеңіз' })
  }
}

onMounted(load)
</script>
