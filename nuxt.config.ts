// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  modules: ['@nuxtjs/tailwindcss'],

  app: {
    head: {
      htmlAttrs: { lang: 'kk' },
      title: 'FaceAttend',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#495cf8' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
      ],
    },
  },

  runtimeConfig: {
    // Құпияларды кодқа жазбаймыз: JWT_SECRET / DATABASE_URL орта айнымалыларынан оқылады
    jwtSecret: '',
    public: {
      apiBase: '/api',
      timezone: process.env.APP_TIMEZONE || 'Asia/Almaty',
    },
  },

  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
  },

  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
      },
    },
  },

  nitro: {
    // Статиканы сборка кезінде gzip/brotli етіп сығамыз: face-api JS ~1.3 МБ -> ~0.3 МБ
    compressPublicAssets: { gzip: true, brotli: true },
    experimental: {
      asyncContext: true,
    },
  },
})
