interface User {
  id: number
  login: string
  name: string
  role: 'admin' | 'head' | 'manager'
  departmentId?: number | null
  mustChangePassword?: boolean
}

export const useAuth = () => {
  const user = useState<User | null>('auth_user', () => null)
  // SSR кезінде $fetch браузердің cookie-ін жібермейді — сондықтан бетті жаңартқанда
  // жүйе «кірмеген» деп логинге қайтаратын. useRequestFetch бастапқы сұраныстың cookie-ін береді.
  const requestFetch = useRequestFetch()
  const isLoggedIn = computed(() => !!user.value)

  const login = async (loginStr: string, password: string) => {
    const data = await $fetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: { login: loginStr, password },
    })
    user.value = data.user
    return data.user
  }

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    navigateTo('/login')
  }

  const fetchUser = async () => {
    try {
      const data = await requestFetch<{ user: User }>('/api/auth/me')
      user.value = data.user
    } catch {
      user.value = null
    }
  }

  const isAdmin = computed(() => user.value?.role === 'admin')
  const isHead = computed(() => user.value?.role === 'head')
  const isManager = computed(() => user.value?.role === 'manager')

  return { user, isLoggedIn, login, logout, fetchUser, isAdmin, isHead, isManager }
}
