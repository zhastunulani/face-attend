<template>
  <div class="min-h-screen grid lg:grid-cols-2 bg-white">
    <!-- Фирмалық панель -->
    <div class="hidden lg:flex relative overflow-hidden bg-grad-brand text-white p-12 flex-col justify-between">
      <AppLogo dark :size="40" />
      <div class="relative z-10 max-w-md">
        <h1 class="text-4xl font-semibold leading-tight tracking-tight">Жұмыс уақытын есепке алу — бетпен танумен</h1>
        <p class="mt-4 text-white/75 text-lg">Келу-кету, табель, демалыстар және жалақы — бір жерде.</p>
        <ul class="mt-8 space-y-3 text-white/85">
          <li class="flex items-center gap-3"><span class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center"><AppIcon name="scan" :size="18" /></span>Кіреберістегі киоск — қолсыз белгі</li>
          <li class="flex items-center gap-3"><span class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center"><AppIcon name="calendar" :size="18" /></span>Автоматты табель және мерекелер</li>
          <li class="flex items-center gap-3"><span class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center"><AppIcon name="wallet" :size="18" /></span>Үстеме мен демалыс күндерін ескеретін жалақы</li>
        </ul>
      </div>
      <p class="relative z-10 text-sm text-white/50">© {{ new Date().getFullYear() }} FaceAttend</p>
      <!-- Сәндік шеңберлер -->
      <div class="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-white/5" />
      <div class="absolute right-24 top-24 w-40 h-40 rounded-full bg-white/5" />
    </div>

    <!-- Кіру формасы -->
    <div class="flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-sm">
        <div class="lg:hidden mb-10"><AppLogo :size="40" /></div>
        <h2 class="text-2xl font-semibold tracking-tight text-navy">Жүйеге кіру</h2>
        <p class="text-sm text-ink-muted mt-1.5">Логин мен құпия сөзді енгізіңіз</p>

        <form class="mt-8 space-y-5" @submit.prevent="handleLogin">
          <div>
            <label class="label" for="login">Логин</label>
            <input id="login" v-model="form.login" type="text" class="input !py-2.5" autocomplete="username" autocapitalize="none" required />
          </div>
          <div>
            <label class="label" for="password">Құпия сөз</label>
            <input id="password" v-model="form.password" type="password" class="input !py-2.5" autocomplete="current-password" required />
          </div>
          <div v-if="error" class="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            <AppIcon name="alert" :size="16" class="mt-0.5 shrink-0" />{{ error }}
          </div>
          <button type="submit" :disabled="loading" class="btn-primary w-full !py-2.5">
            {{ loading ? 'Кіру...' : 'Кіру' }}
          </button>
        </form>

        <div class="mt-10 pt-6 border-t border-gray-100">
          <NuxtLink to="/scan" class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm hover:border-primary-300 hover:bg-primary-50/50 transition-colors">
            <span class="flex items-center gap-3 text-ink">
              <span class="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><AppIcon name="scan" :size="18" /></span>
              Сканерлеу (киоск)
            </span>
            <AppIcon name="chevron-right" :size="18" class="text-gray-400" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { login } = useAuth()
const form = reactive({ login: '', password: '' })
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  error.value = ''
  loading.value = true
  try {
    const user = await login(form.login, form.password)
    // ?redirect=/scan — киоск-қолданбадан кіргенде сканерге қайту (тек өз сайтының жолы)
    const r = useRoute().query.redirect
    const back = typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/'
    navigateTo(user.mustChangePassword ? '/settings' : back)
  } catch (e: any) {
    error.value = e.data?.message || e.data?.statusMessage || 'Кіру кезінде қате пайда болды'
  } finally {
    loading.value = false
  }
}
</script>
