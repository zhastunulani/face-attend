import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

// Фирмалық токендер (компанияның :root айнымалылары):
//   --c-accent-2 #495cf8 — негізгі түс, --c-accent #1f64d3 — екінші акцент,
//   --c-base #0e3449 — қою көк (сайдбар), --c-dark #28293d / --c-dark-2 #555770 — мәтін,
//   --c-chance-high/mid/low — күйлер, --gradient-* — көрсеткіш карточкалары.
export default <Config>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        // --f-base: Inter (кирилл + қазақ әріптері), содан кейін Roboto, DM Sans, жүйелік
        sans: ['Inter', 'Roboto', '"DM Sans"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          50: '#eef0ff',
          100: '#e0e4ff',
          200: '#c7cdfe',
          300: '#a4acfc',
          400: '#7f88fa',
          500: '#5f6cf9',
          600: '#495cf8', // --c-accent-2
          700: '#1f64d3', // --c-accent (hover/active)
          800: '#1d4fa8',
          900: '#1b3f82',
          950: '#0e3449', // --c-base
        },
        navy: {
          DEFAULT: '#0e3449', // --c-base (атауы `base` емес: text-base Tailwind-те қаріп өлшемі)
          light: '#16475f',
          lighter: '#1f5a76',
        },
        ink: {
          DEFAULT: '#28293d', // --c-dark
          muted: '#555770', // --c-dark-2
        },
        status: {
          ok: '#22c55e', // --c-chance-high
          warn: '#f5b82e', // --c-chance-mid
          bad: '#ff5c5c', // --c-chance-low
          danger: '#ff3b3b', // --c-red
        },
        brandpurple: '#6600cc', // --c-purple
      },
      backgroundImage: {
        'grad-dark': 'linear-gradient(129.3deg, #28293d, #8e90a6)',
        'grad-green': 'linear-gradient(129.3deg, #05a660, #39d98a)',
        'grad-orange': 'linear-gradient(129.3deg, #e57a00, #fdac42)',
        'grad-blue': 'linear-gradient(129.3deg, #004fc4, #5b8def)',
        'grad-purple': 'linear-gradient(129.3deg, #6600cc, #ac5dd9)',
        'grad-brand': 'linear-gradient(135deg, #0e3449 0%, #1f64d3 60%, #495cf8 100%)',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(14 52 73 / 0.05)',
        pop: '0 12px 32px -8px rgb(14 52 73 / 0.22)',
        blue: '0 0 4px 1px rgba(62, 123, 250, .3)', // --shadow-blue
      },
    },
  },
  plugins: [],
}
