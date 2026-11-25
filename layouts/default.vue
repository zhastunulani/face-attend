<template>
  <div class="min-h-screen bg-gray-50">
    <!-- ==================== Сайдбар (desktop) ==================== -->
    <aside class="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-navy text-white">
      <div class="h-16 flex items-center px-5 border-b border-white/10">
        <NuxtLink to="/" aria-label="Басты бет"><AppLogo dark /></NuxtLink>
      </div>
      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Негізгі мәзір">
        <div v-for="group in navGroups" :key="group.title">
          <p class="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{{ group.title }}</p>
          <ul class="space-y-0.5">
            <li v-for="item in group.items" :key="item.path">
              <NuxtLink
                :to="item.path"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                :class="isActive(item.path) ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'"
              >
                <AppIcon :name="item.icon" :size="18" :class="isActive(item.path) ? 'text-primary-300' : ''" />
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </nav>
      <div class="p-3 border-t border-white/10">
        <div class="flex items-center gap-3 rounded-lg px-2 py-2">
          <span class="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center font-semibold shrink-0">{{ user?.name?.charAt(0) }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">{{ user?.name }}</p>
            <p class="text-xs text-white/50">{{ roleLabel }}</p>
          </div>
          <button class="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10" title="Шығу" aria-label="Шығу" @click="logout">
            <AppIcon name="logout" :size="18" />
          </button>
        </div>
      </div>
    </aside>

    <!-- ==================== Жоғарғы панель (mobile) ==================== -->
    <header class="lg:hidden sticky top-0 z-40 h-14 bg-white/90 backdrop-blur border-b border-gray-200 flex items-center justify-between px-4">
      <NuxtLink to="/" aria-label="Басты бет"><AppLogo :size="28" /></NuxtLink>
      <button class="p-2 -mr-2 rounded-lg text-ink-muted hover:bg-gray-100" aria-label="Мәзір" @click="drawer = true">
        <AppIcon name="menu" />
      </button>
    </header>

    <!-- ==================== Мәзір (mobile drawer) ==================== -->
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
      <div v-if="drawer" class="lg:hidden fixed inset-0 z-50 bg-navy/40" @click="drawer = false" />
    </Transition>
    <Transition enter-active-class="transition-transform duration-200" enter-from-class="translate-x-full" leave-active-class="transition-transform duration-150" leave-to-class="translate-x-full">
      <aside v-if="drawer" class="lg:hidden fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-navy text-white flex flex-col shadow-pop">
        <div class="h-14 flex items-center justify-between px-4 border-b border-white/10">
          <AppLogo dark :size="28" />
          <button class="p-2 -mr-2 rounded-lg text-white/70 hover:bg-white/10" aria-label="Жабу" @click="drawer = false">
            <AppIcon name="x" />
          </button>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div v-for="group in navGroups" :key="group.title">
            <p class="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">{{ group.title }}</p>
            <NuxtLink
              v-for="item in group.items" :key="item.path" :to="item.path"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
              :class="isActive(item.path) ? 'bg-white/10 text-white' : 'text-white/75'"
              @click="drawer = false"
            >
              <AppIcon :name="item.icon" :size="18" />{{ item.label }}
            </NuxtLink>
          </div>
        </nav>
        <div class="p-4 border-t border-white/10 flex items-center gap-3">
          <span class="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center font-semibold">{{ user?.name?.charAt(0) }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">{{ user?.name }}</p>
            <p class="text-xs text-white/50">{{ roleLabel }}</p>
          </div>
          <button class="btn !bg-white/10 !text-white hover:!bg-white/20" @click="logout"><AppIcon name="logout" :size="16" />Шығу</button>
        </div>
      </aside>
    </Transition>

    <!-- ==================== Мазмұн ==================== -->
    <div class="lg:pl-64">
      <div v-if="user?.mustChangePassword" class="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-900 flex items-center justify-center gap-2">
        <AppIcon name="alert" :size="16" />
        Қауіпсіздік үшін құпия сөзді ауыстырыңыз: Баптаулар → Құпия сөзді өзгерту
      </div>
      <main class="pb-24 lg:pb-0">
        <slot />
      </main>
    </div>

    <!-- ==================== Төменгі навигация (mobile) ==================== -->
    <nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]" aria-label="Жылдам мәзір">
      <div class="grid grid-cols-5">
        <NuxtLink
          v-for="item in mobileNav" :key="item.path" :to="item.path"
          class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
          :class="isActive(item.path) ? 'text-primary-600' : 'text-ink-muted'"
        >
          <AppIcon :name="item.icon" :size="22" />{{ item.label }}
        </NuxtLink>
        <button class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-muted" @click="drawer = true">
          <AppIcon name="menu" :size="22" />Мәзір
        </button>
      </div>
    </nav>

    <!-- ==================== Хабарламалар ==================== -->
    <div class="fixed bottom-20 lg:bottom-6 right-4 left-4 lg:left-auto z-[60] flex flex-col gap-2 lg:w-96 pointer-events-none" aria-live="polite">
      <div
        v-for="t in toasts" :key="t.id"
        class="rounded-xl px-4 py-3 text-sm shadow-pop border pointer-events-auto flex items-start gap-2 bg-white"
        :class="t.kind === 'error' ? 'border-red-200 text-red-700' : 'border-green-200 text-green-700'"
        role="status"
      >
        <AppIcon :name="t.kind === 'error' ? 'alert' : 'check'" :size="18" class="shrink-0 mt-px" />
        <span>{{ t.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { user, logout } = useAuth()
const { toasts } = useNotify()
const drawer = ref(false)

const roleLabel = computed(() => {
  const labels: Record<string, string> = { admin: 'Әкімші', head: 'Бөлім басшысы', manager: 'Менеджер' }
  return user.value ? labels[user.value.role] || user.value.role : ''
})

type Role = 'admin' | 'head' | 'manager'
interface NavItem { path: string; label: string; icon: string; roles?: Role[] }

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Негізгі',
    items: [
      { path: '/', label: 'Басты бет', icon: 'home' },
      { path: '/attendance', label: 'Табель', icon: 'calendar' },
      { path: '/scan', label: 'Сканерлеу', icon: 'scan' },
    ],
  },
  {
    title: 'Персонал',
    items: [
      { path: '/employees', label: 'Қызметкерлер', icon: 'users' },
      { path: '/leaves', label: 'Демалыс', icon: 'plane', roles: ['admin', 'head', 'manager'] },
      { path: '/payroll', label: 'Жалақы', icon: 'wallet', roles: ['admin', 'head'] },
      { path: '/kpi', label: 'KPI', icon: 'target', roles: ['admin', 'head'] },
    ],
  },
  {
    title: 'Басқару',
    items: [
      { path: '/departments', label: 'Бөлімдер', icon: 'building', roles: ['admin'] },
      { path: '/positions', label: 'Лауазымдар', icon: 'briefcase', roles: ['admin'] },
      { path: '/schedules', label: 'Кестелер', icon: 'clock', roles: ['admin'] },
      { path: '/users', label: 'Пайдаланушылар', icon: 'key', roles: ['admin'] },
      { path: '/audit', label: 'Журнал', icon: 'list', roles: ['admin'] },
      { path: '/settings', label: 'Баптаулар', icon: 'settings' },
    ],
  },
]

const navGroups = computed(() => groups
  .map(g => ({ ...g, items: g.items.filter(i => !i.roles || (user.value && i.roles.includes(user.value.role))) }))
  .filter(g => g.items.length))

const mobileNav = [
  { path: '/', label: 'Басты', icon: 'home' },
  { path: '/attendance', label: 'Табель', icon: 'calendar' },
  { path: '/scan', label: 'Скан', icon: 'scan' },
  { path: '/employees', label: 'Адамдар', icon: 'users' },
]

const isActive = (path: string) => (path === '/' ? route.path === '/' : route.path.startsWith(path))

watch(() => route.path, () => { drawer.value = false })
</script>
