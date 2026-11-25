// Киоскідегі дауыстық нұсқаулар.
// Құрылғылардың көбінде қазақ TTS дауысы жоқ, сондықтан фразалар алдын ала жазылған
// (public/voice/<тіл>/*.mp3, Microsoft нейрондық дауысы) және Web Audio арқылы ойнатылады.
// Браузерлер дыбысты пайдаланушы экранды бір рет басқаннан кейін ғана рұқсат етеді.

export type VoiceLang = 'kk' | 'ru' | 'off'
export type Phrase =
  | 'look_straight' | 'turn_head' | 'look_again' | 'one_face'
  | 'welcome' | 'welcome_late' | 'bye' | 'bye_early'
  | 'not_recognized' | 'already' | 'error'

const PHRASES: Phrase[] = [
  'look_straight', 'turn_head', 'look_again', 'one_face',
  'welcome', 'welcome_late', 'bye', 'bye_early', 'not_recognized', 'already', 'error',
]
const STORAGE_KEY = 'faceattend.voice'

export function useVoice() {
  const supported = import.meta.client && !!(window.AudioContext || (window as any).webkitAudioContext)
  const lang = ref<VoiceLang>('kk')
  const unlocked = ref(false)

  let ctx: AudioContext | null = null
  const buffers = new Map<string, AudioBuffer>()
  let current: AudioBufferSourceNode | null = null
  let lastKey = ''
  let lastAt = 0

  const init = () => {
    if (!import.meta.client) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'kk' || saved === 'ru' || saved === 'off') lang.value = saved
    } catch { /* жеке режим */ }
  }

  /** Таңдалған тілдің барлық фразаларын алдын ала жүктеу (кідіріссіз ойнату үшін) */
  const preload = async () => {
    if (!ctx || lang.value === 'off') return
    const l = lang.value
    await Promise.all(PHRASES.map(async (p) => {
      const key = `${l}/${p}`
      if (buffers.has(key)) return
      try {
        const res = await fetch(`/voice/${key}.mp3`)
        const data = await res.arrayBuffer()
        buffers.set(key, await ctx!.decodeAudioData(data))
      } catch { /* файл жоқ — үнсіз өтеміз */ }
    }))
  }

  /** Пайдаланушы экранды басқанда шақырылады — браузер дыбысқа рұқсат береді */
  const unlock = () => {
    if (!supported) return
    if (!ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      ctx = new Ctx()
    }
    ctx.resume().catch(() => {})
    if (!unlocked.value) {
      unlocked.value = true
      preload()
    }
  }

  const setLang = (v: VoiceLang) => {
    lang.value = v
    try { localStorage.setItem(STORAGE_KEY, v) } catch { /* ignore */ }
    if (v === 'off') current?.stop()
    else preload()
  }

  /**
   * Фразаны ойнату. Бірдей фраза `repeatAfterMs` ішінде қайталанбайды.
   * `interrupt` — алдыңғы фразаны үзу (нәтиже хабарлары үшін); әйтпесе сөйлеп тұрғанда жаңасы өткізіледі.
   */
  const say = (key: Phrase, opts: { repeatAfterMs?: number; interrupt?: boolean; delay?: number } = {}) => {
    if (!ctx || lang.value === 'off') return
    const now = Date.now()
    if (key === lastKey && now - lastAt < (opts.repeatAfterMs ?? 6000)) return
    const buf = buffers.get(`${lang.value}/${key}`)
    if (!buf) return
    if (current) {
      if (!opts.interrupt) return
      current.stop()
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.onended = () => { if (current === src) current = null }
    src.start(ctx.currentTime + (opts.delay ?? 0))
    current = src
    lastKey = key
    lastAt = now
  }

  /** Қысқа сигнал: сәтті — екі жоғары нота, қате — бір төмен нота */
  const chime = (kind: 'ok' | 'fail') => {
    if (!ctx || lang.value === 'off') return
    const notes = kind === 'ok' ? [[880, 0], [1320, 0.12]] : [[220, 0]]
    for (const [freq, delay] of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + delay
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'ok' ? 0.18 : 0.35))
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    }
  }

  const stop = () => {
    current?.stop()
    ctx?.close().catch(() => {})
    ctx = null
  }

  return { supported, lang, unlocked, init, setLang, unlock, say, chime, stop }
}
