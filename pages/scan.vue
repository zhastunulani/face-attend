<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Top bar -->
    <div class="bg-navy text-white px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <NuxtLink v-if="!kiosk" to="/" class="p-2 -ml-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10" aria-label="Артқа">
          <AppIcon name="chevron-left" />
        </NuxtLink>
        <!-- 8 рет басу — әкімші режимі (қолданбада) немесе кіру беті (браузерде) -->
        <button type="button" class="relative select-none" aria-label="FaceAttend" @click="onLogoTap">
          <AppLogo dark :size="30" />
        </button>
        <span v-if="tapHint" class="text-xs text-white/70">{{ tapHint }}</span>
      </div>
      <div class="flex items-center gap-3">
      <button
        v-if="voice.supported && canScan"
        type="button"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20"
        :title="voiceTitle"
        @click="cycleVoice"
      >
        <AppIcon :name="voice.lang.value === 'off' ? 'volume-x' : 'volume'" :size="18" />
        <span class="hidden sm:inline">{{ voiceLabel }}</span>
      </button>
      <div class="text-right leading-tight">
        <p class="text-2xl font-semibold tabular-nums tracking-tight">{{ clock }}</p>
        <p class="text-xs text-white/60">{{ todayLabel }}</p>
      </div>
      </div>
    </div>

    <!-- Браузер дыбысты тек экранды басқаннан кейін рұқсат етеді -->
    <button
      v-if="canScan && voice.supported && voice.lang.value !== 'off' && !voice.unlocked.value"
      type="button"
      class="w-full bg-primary-600 text-white text-sm py-2 flex items-center justify-center gap-2"
      @click="voice.unlock(); voice.sample()"
    >
      <AppIcon name="volume" :size="16" /> Дыбысты қосу үшін экранды бір рет басыңыз
    </button>

    <div class="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <!-- Status indicator -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="w-3 h-3 rounded-full transition-colors duration-300"
            :class="faceDetected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'"
          />
          <span class="text-sm font-medium" :class="faceDetected ? 'text-green-600' : 'text-gray-400'">
            {{ faceDetected ? 'Бет анықталды' : 'Бет табылмады' }}
          </span>
          <span v-if="kiosk" class="text-xs text-gray-400">· {{ kiosk.name }} · {{ modeLabel }}</span>
        </div>
        <button
          v-if="!kiosk"
          @click="autoScan = !autoScan"
          class="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
          :class="autoScan
            ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
        >
          {{ autoScan ? 'Авто-сканер: қосулы' : 'Авто-сканер' }}
        </button>
      </div>

      <!-- Kiosk not activated -->
      <div v-if="kioskChecked && !canScan" class="rounded-2xl p-5 bg-yellow-50 border border-yellow-200 text-sm text-yellow-800 space-y-2">
        <p class="font-semibold">Бұл құрылғы киоск ретінде тіркелмеген</p>
        <p>Сканерлеу тек тіркелген құрылғыдан мүмкін. Әкімші немесе бөлім басшысы осы құрылғыда жүйеге кіріп, киоскіні белсендіруі керек.</p>
        <NuxtLink to="/login?redirect=/scan" class="inline-block text-primary-600 font-medium hover:underline">Жүйеге кіру →</NuxtLink>
      </div>
      <div v-else-if="kioskChecked && !kiosk && canActivate" class="rounded-xl p-4 bg-white border border-primary-200 shadow-card text-sm space-y-3">
        <div class="flex items-start gap-3">
          <span class="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><AppIcon name="door-open" :size="18" /></span>
          <div>
            <p class="font-medium text-navy">Осы құрылғыны киоск ету</p>
            <p class="text-ink-muted">Қазір сіз өз аккаунтыңызбен сканерлеп жатырсыз. Есік алдындағы планшет/телефон үшін киоск ретінде тіркеңіз.</p>
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
        <input v-model="kioskName" class="input sm:flex-1" placeholder="Киоск атауы" />
        <select v-model="kioskMode" class="input sm:w-40">
          <option value="auto">Бір есік (авто)</option>
          <option value="in">Тек кіру</option>
          <option value="out">Тек шығу</option>
        </select>
        <button class="btn-primary" :disabled="activating" @click="activateKiosk">Киоск ету</button>
        </div>
      </div>

      <!-- Camera feed -->
      <div v-if="canScan" class="relative rounded-2xl overflow-hidden bg-black shadow-lg aspect-[4/3]">
        <video
          ref="videoRef"
          autoplay
          playsinline
          muted
          class="w-full h-full object-cover -scale-x-100"
        />
        <canvas ref="canvasRef" class="absolute inset-0 w-full h-full -scale-x-100" />

        <!-- Loading overlay -->
        <div
          v-if="!modelsLoaded || !cameraReady"
          class="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-3"
        >
          <div class="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p class="text-sm">{{ loadingMessage }}</p>
        </div>

        <!-- Liveness hint -->
        <div
          v-if="modelsLoaded && cameraReady && faceDetected && !processing"
          class="absolute bottom-3 left-3 right-3 rounded-xl px-3 py-2 text-sm font-medium text-center"
          :class="livenessPassed ? 'bg-green-500/90 text-white' : 'bg-black/60 text-white'"
        >
          {{ livenessHint }}
        </div>

        <!-- Processing overlay -->
        <div
          v-if="processing"
          class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white gap-3"
        >
          <div class="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p class="text-sm">Тексерілуде...</p>
        </div>
      </div>

      <!-- Kiosk: қолсыз режим — кнопкалар жоқ -->
      <p v-if="kiosk && !result" class="text-center text-gray-500 text-sm">
        Камераға қарап, басыңызды сәл бұрыңыз — белгі өзі жазылады
      </p>

      <!-- Action buttons (әкімші өз аккаунтымен сканерлегенде) -->
      <div v-if="canScan && !kiosk" class="grid grid-cols-2 gap-3">
        <button
          @click="handleScan('in')"
          :disabled="!canSubmit"
          class="py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200
            bg-green-500 hover:bg-green-600 active:scale-[0.97]
            disabled:bg-gray-300 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Келді (Check-in)
        </button>
        <button
          @click="handleScan('out')"
          :disabled="!canSubmit"
          class="py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200
            bg-orange-500 hover:bg-orange-600 active:scale-[0.97]
            disabled:bg-gray-300 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Кетті (Check-out)
        </button>
      </div>

      <!-- Result card -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-4"
      >
        <div v-if="result" class="rounded-2xl bg-white shadow-pop overflow-hidden">
          <!-- Тақырып: кім және не болды -->
          <div class="flex items-center gap-4 px-5 py-4 text-white" :class="resultTone.head">
            <div class="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-semibold shrink-0">
              <AppIcon v-if="!result.employeeName" name="alert" class="w-7 h-7" />
              <template v-else>{{ result.employeeName.charAt(0) }}</template>
            </div>
            <div class="min-w-0">
              <p class="text-sm/5 opacity-90">{{ resultTone.title }}</p>
              <p class="font-semibold truncate" :class="kiosk ? 'text-2xl' : 'text-xl'">
                {{ result.employeeName || 'Белгі қойылмады' }}
              </p>
            </div>
          </div>

          <!-- Негізгі сандар -->
          <div v-if="result.success" class="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            <div v-for="f in resultFacts" :key="f.label" class="px-3 py-3 text-center">
              <p class="text-[11px] uppercase tracking-wide text-gray-400">{{ f.label }}</p>
              <p class="font-semibold tabular-nums mt-0.5" :class="[f.tone, kiosk ? 'text-xl' : 'text-lg']">{{ f.value }}</p>
            </div>
          </div>

          <!-- Түсіндірме -->
          <p class="px-5 py-3 text-gray-600" :class="kiosk ? 'text-base' : 'text-sm'">{{ result.message }}</p>
        </div>
      </Transition>

      <!-- Error message -->
      <div v-if="errorMsg" class="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
        {{ errorMsg }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

let faceapi: any = null

// Refs
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// State
const modelsLoaded = ref(false)
const cameraReady = ref(false)
const faceDetected = ref(false)
const processing = ref(false)
const autoScan = ref(false)
const errorMsg = ref('')
const loadingMessage = ref('Модельдер жүктелуде...')

const result = ref<{
  success: boolean
  employeeName?: string
  message: string
  type?: 'in' | 'out'
  time?: string
  isLate?: boolean
  lateMinutes?: number
  overtimeMinutes?: number
  earlyLeaveMinutes?: number
  workedMinutes?: number
  checkIn?: string
  scheduleStart?: string | null
  scheduleEnd?: string | null
} | null>(null)

const resultTone = computed(() => {
  const r = result.value
  if (!r?.success) return { head: 'bg-grad-dark', title: r?.employeeName ? 'Назар аударыңыз' : 'Қайталап көріңіз' }
  if (r.type === 'in') {
    return r.lateMinutes ? { head: 'bg-grad-orange', title: 'Келу тіркелді · кешігу' } : { head: 'bg-grad-green', title: 'Қош келдіңіз! Келу тіркелді' }
  }
  return r.earlyLeaveMinutes ? { head: 'bg-grad-orange', title: 'Кету тіркелді · ерте' } : { head: 'bg-grad-blue', title: 'Сау болыңыз! Кету тіркелді' }
})

const resultFacts = computed(() => {
  const r = result.value
  if (!r?.success) return []
  if (r.type === 'in') {
    return [
      { label: 'Келдіңіз', value: r.time || '—', tone: 'text-navy' },
      { label: 'Жұмыс басы', value: r.scheduleStart || '—', tone: 'text-gray-700' },
      r.lateMinutes
        ? { label: 'Кешігу', value: formatMinutes(r.lateMinutes), tone: 'text-orange-600' }
        : { label: 'Күйі', value: r.scheduleStart ? 'Уақытында' : '—', tone: 'text-green-600' },
    ]
  }
  return [
    { label: 'Келу → кету', value: `${hhmm(r.checkIn)}–${r.time}`, tone: 'text-navy' },
    { label: 'Жұмыс уақыты', value: formatMinutes(r.workedMinutes || 0), tone: 'text-gray-700' },
    r.overtimeMinutes
      ? { label: 'Үстеме', value: formatMinutes(r.overtimeMinutes), tone: 'text-primary-600' }
      : r.earlyLeaveMinutes
        ? { label: 'Ерте кету', value: formatMinutes(r.earlyLeaveMinutes), tone: 'text-orange-600' }
        : { label: 'Жұмыс соңы', value: r.scheduleEnd || '—', tone: 'text-gray-700' },
  ]
})

// ==================== Сағат ====================

const clock = ref('')
const todayLabel = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null
const tick = () => {
  const d = new Date()
  clock.value = clockText(d)
  todayLabel.value = longDateText(d)
}

// ==================== Kiosk ====================

const kiosk = ref<{ id: number; name: string; mode: 'auto' | 'in' | 'out' } | null>(null)
const kioskMode = ref<'auto' | 'in' | 'out'>('auto')
const modeLabel = computed(() => ({ auto: 'кіру/шығу', in: 'кіру', out: 'шығу' })[kiosk.value?.mode ?? 'auto'])
const canActivate = ref(false)
const kioskChecked = ref(false)
const kioskName = ref('Кіреберіс')
const activating = ref(false)
const canScan = computed(() => !!kiosk.value || canActivate.value)

const loadKioskStatus = async () => {
  try {
    const data = await $fetch<{ kiosk: { id: number; name: string; mode: 'auto' | 'in' | 'out' } | null; canActivate: boolean }>('/api/kiosk/status')
    kiosk.value = data.kiosk
    canActivate.value = data.canActivate
  } catch {
    kiosk.value = null
  } finally {
    kioskChecked.value = true
  }
}

const activateKiosk = async () => {
  activating.value = true
  try {
    kiosk.value = await $fetch<{ id: number; name: string; mode: 'auto' | 'in' | 'out' }>('/api/kiosk/activate', { method: 'POST', body: { name: kioskName.value, mode: kioskMode.value } })
    requestWakeLock()
  } catch (e: any) {
    errorMsg.value = e.data?.message || 'Киоскіні белсендіру мүмкін болмады'
  } finally {
    activating.value = false
  }
}

// ==================== Жасырын әкімші режимі ====================
// Android киоск-қолданбасы `window.FaceAttendApp` көпірін береді.

const ADMIN_TAPS = 8
let taps = 0
let tapTimer: ReturnType<typeof setTimeout> | null = null
const tapHint = ref('')
const appBridge = (): { openAdmin: () => void } | null =>
  import.meta.client ? (window as any).FaceAttendApp ?? null : null

const onLogoTap = () => {
  taps++
  if (tapTimer) clearTimeout(tapTimer)
  tapTimer = setTimeout(() => { taps = 0; tapHint.value = '' }, 2500)
  const left = ADMIN_TAPS - taps
  if (left <= 0) {
    taps = 0
    tapHint.value = ''
    const bridge = appBridge()
    if (bridge) bridge.openAdmin()
    else navigateTo('/login?redirect=/scan')
    return
  }
  // Android-тағы «әзірлеуші режимі» сияқты: соңғы басуларда кері санақ
  tapHint.value = left <= 4 ? `тағы ${left}` : ''
}

// ==================== Дауыстық нұсқаулар ====================

const voice = useVoice()
const VOICE_LABELS = { kk: 'Қазақша', ru: 'Орысша', off: 'Дыбыссыз' } as const
const voiceLabel = computed(() => VOICE_LABELS[voice.lang.value])
const voiceTitle = 'Дауыстық нұсқаулар: басып ауыстыру (қазақша → орысша → дыбыссыз)'
const cycleVoice = () => {
  voice.unlock()
  const order = ['kk', 'ru', 'off'] as const
  const next = order[(order.indexOf(voice.lang.value) + 1) % order.length]
  voice.setLang(next)
  if (next !== 'off') voice.sample()
}

const UNLOCK_EVENTS = ['click', 'touchend', 'keydown'] as const
const onUserGesture = () => { if (!voice.unlocked.value) voice.unlock() }

/** Әр кадрдан кейін: қазіргі кезеңге сай нұсқау (бірдей фраза жиі қайталанбайды) */
const voicePrompt = () => {
  if (processing.value || result.value) return
  if (!faceDetected.value) return
  if (stage.value === 'front1') voice.say('look_straight', { repeatAfterMs: 8000 })
  else if (stage.value === 'turn') voice.say('turn_head', { repeatAfterMs: 5000 })
  else if (stage.value === 'front2') voice.say('look_again', { repeatAfterMs: 5000 })
}

// ==================== Liveness (басты бұру) ====================
// Тегіс фотоны бұрғанда бет пропорциялары өзгермейді, ал тірі адам басын бұрғанда
// мұрын көз сызығына қатысты жылжиды. Реттілік: тура -> бүйірге -> тура.

type LivenessStage = 'front1' | 'turn' | 'front2' | 'passed'
const stage = ref<LivenessStage>('front1')
let passedAt = 0
let frontalDescriptors: Float32Array[] = []
const LIVENESS_TTL_MS = 5000
const MULTI_FACE_MSG = 'Кадрда тек бір адам болуы керек'

const livenessPassed = computed(() => stage.value === 'passed')
const livenessHint = computed(() => {
  switch (stage.value) {
    case 'front1': return 'Камераға тура қараңыз'
    case 'turn': return 'Басыңызды сәл оңға немесе солға бұрыңыз'
    case 'front2': return 'Енді қайтадан тура қараңыз'
    default: return 'Дайын — тіркеуге болады'
  }
})

const resetLiveness = () => {
  stage.value = 'front1'
  frontalDescriptors = []
  passedAt = 0
}

/** Мұрын ұшының көздердің сыртқы бұрыштары арасындағы орны: ~0.5 = тура */
const yawRatio = (landmarks: any): number => {
  const pts = landmarks.positions
  const left = pts[36].x
  const right = pts[45].x
  return (pts[30].x - left) / (right - left)
}

const updateLiveness = (ratio: number, descriptor: Float32Array) => {
  const frontal = ratio > 0.4 && ratio < 0.6
  const turned = ratio < 0.3 || ratio > 0.7
  if (frontal) {
    frontalDescriptors.push(descriptor)
    if (frontalDescriptors.length > 3) frontalDescriptors.shift()
  }
  if (stage.value === 'front1' && frontal && frontalDescriptors.length >= 2) stage.value = 'turn'
  else if (stage.value === 'turn' && turned) stage.value = 'front2'
  else if (stage.value === 'front2' && frontal) {
    stage.value = 'passed'
    passedAt = Date.now()
  }
  if (stage.value === 'passed' && Date.now() - passedAt > LIVENESS_TTL_MS) resetLiveness()
}

const canSubmit = computed(() =>
  canScan.value && modelsLoaded.value && faceDetected.value && livenessPassed.value && !processing.value)

// ==================== Models & camera ====================

// Киоск үшін жеңіл детектор: TinyFaceDetector (0.19 МБ) SSD MobileNet (5.6 МБ) орнына — жүктелуі
// және кадр өңдеуі әлдеқайда жылдам. Дескрипторды бұрынғыдай faceRecognitionNet есептейді,
// сондықтан тіркелген эталондармен үйлесімді.
const detectorOptions = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })

const loadModels = async () => {
  loadingMessage.value = 'Модельдер жүктелуде...'
  try {
    faceapi = await import('@vladmandic/face-api')
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    ])
    // Алғашқы есептеу WebGL шейдерлерін компиляциялайды (бірнеше секунд) — оны алдын ала жасаймыз,
    // әйтпесе бірінші адам кадрда «қатып» тұрғандай көрінеді
    loadingMessage.value = 'Дайындалуда...'
    const warm = document.createElement('canvas')
    warm.width = 160
    warm.height = 120
    await faceapi.detectAllFaces(warm, detectorOptions()).withFaceLandmarks().withFaceDescriptors()
    modelsLoaded.value = true
  } catch (e) {
    console.error('Failed to load face-api models:', e)
    errorMsg.value = 'Модельдерді жүктеу кезінде қате болды. Бетті жаңартып көріңіз.'
  }
}

const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await new Promise<void>((resolve) => {
        videoRef.value!.onloadedmetadata = () => resolve()
      })
      cameraReady.value = true
    }
  } catch (e) {
    console.error('Camera error:', e)
    errorMsg.value = 'Камераға қол жеткізу мүмкін болмады. Рұқсатты тексеріңіз.'
  }
}

// ==================== Detection loop ====================

let stopped = false
let loopTimer: ReturnType<typeof setTimeout> | null = null

const detectFaces = async () => {
  const video = videoRef.value
  const canvas = canvasRef.value
  if (!video || !canvas || !modelsLoaded.value || !cameraReady.value || processing.value) return

  const displaySize = { width: video.videoWidth, height: video.videoHeight }
  faceapi.matchDimensions(canvas, displaySize)

  const detections = await faceapi
    .detectAllFaces(video, detectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors()

  const ctx = canvas.getContext('2d')
  ctx?.clearRect(0, 0, canvas.width, canvas.height)

  // Кадрда дәл бір адам болуы керек
  if (detections.length !== 1) {
    faceDetected.value = false
    resetLiveness()
    if (detections.length > 1) {
      errorMsg.value = MULTI_FACE_MSG
      voice.say('one_face', { repeatAfterMs: 8000 })
    }
    return
  }
  if (errorMsg.value === MULTI_FACE_MSG) errorMsg.value = ''

  const detection = detections[0]
  faceDetected.value = true
  const box = faceapi.resizeResults(detection, displaySize).detection.box
  if (ctx) {
    ctx.strokeStyle = livenessPassed.value ? '#22c55e' : '#facc15'
    ctx.lineWidth = 3
    ctx.strokeRect(box.x, box.y, box.width, box.height)
  }
  updateLiveness(yawRatio(detection.landmarks), detection.descriptor)
  voicePrompt()

  // Киоскіде әрқашан қолсыз режим; әкімші үшін — «Авто-сканер» қосылса
  if ((autoScan.value || kiosk.value) && livenessPassed.value && !processing.value) {
    await handleScan('auto')
  }
}

const loop = async () => {
  if (stopped) return
  try {
    await detectFaces()
  } catch (e) {
    console.error('detection error', e)
  }
  loopTimer = setTimeout(loop, 200)
}

const capturePhoto = (): string | null => {
  if (!videoRef.value) return null
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = videoRef.value.videoWidth
  tempCanvas.height = videoRef.value.videoHeight
  const ctx = tempCanvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(videoRef.value, 0, 0)
  return tempCanvas.toDataURL('image/jpeg', 0.8)
}

// ==================== Submit ====================
// Клиент тек бет дескрипторларын жібереді; қызметкерді сервер анықтайды.

const handleScan = async (type: 'in' | 'out' | 'auto') => {
  if (!canSubmit.value || frontalDescriptors.length < 2) return

  errorMsg.value = ''
  result.value = null
  processing.value = true
  const descriptors = frontalDescriptors.map(d => Array.from(d))
  const photo = capturePhoto()

  try {
    const response = await $fetch<{
      success: boolean
      employeeName?: string
      type?: 'in' | 'out'
      time?: string
      isLate?: boolean
      lateMinutes?: number
      overtimeMinutes?: number
      earlyLeaveMinutes?: number
      workedMinutes?: number
      checkIn?: string
      scheduleStart?: string | null
      scheduleEnd?: string | null
      message?: string
    }>('/api/attendance/checkin', {
      method: 'POST',
      body: { type, descriptors, photo },
    })

    result.value = {
      success: response.success,
      employeeName: response.employeeName,
      message: response.message || '',
      type: response.type,
      time: response.time?.slice(0, 5),
      isLate: response.isLate,
      lateMinutes: response.lateMinutes,
      overtimeMinutes: response.overtimeMinutes,
      earlyLeaveMinutes: response.earlyLeaveMinutes,
      workedMinutes: response.workedMinutes,
      checkIn: response.checkIn,
      scheduleStart: response.scheduleStart,
      scheduleEnd: response.scheduleEnd,
    }
    announce(result.value)
  } catch (e: any) {
    result.value = {
      success: false,
      message: e.data?.message || e.data?.statusMessage || e.message || 'Тіркеу кезінде қате пайда болды.',
    }
    voice.chime('fail')
    voice.say(e?.statusCode === 404 || e?.data?.statusCode === 404 ? 'not_recognized' : 'error', { interrupt: true, repeatAfterMs: 0, delay: 0.35 })
  } finally {
    // Нәтиже бірнеше секундтан кейін өзі жоғалады — келесі адамға экран таза
    const shown = result.value
    setTimeout(() => {
      if (result.value === shown) result.value = null
    }, 6000)
    resetLiveness()
    // Келесі адамға дейін қысқа үзіліс (бір адамның қайта-қайта жазылуын болдырмау)
    setTimeout(() => {
      processing.value = false
    }, 2500)
  }
}

/** Нәтижені дауыстап айту: алдымен сигнал, сосын фраза */
const announce = (r: NonNullable<typeof result.value>) => {
  const opts = { interrupt: true, repeatAfterMs: 0, delay: 0.35 }
  if (!r.success) {
    voice.chime('fail')
    voice.say('already', opts)
    return
  }
  voice.chime('ok')
  if (r.type === 'in') voice.say(r.lateMinutes ? 'welcome_late' : 'welcome', opts)
  else voice.say(r.earlyLeaveMinutes ? 'bye_early' : 'bye', opts)
}

// ==================== Wake Lock ====================
// Есік алдындағы телефон/планшет экраны сөнбеуі керек

let wakeLock: { release: () => Promise<void> } | null = null
const requestWakeLock = async () => {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (nav.wakeLock && document.visibilityState === 'visible') wakeLock = await nav.wakeLock.request('screen')
  } catch {
    // қолдамайтын браузер немесе батарея үнемдеу режимі
  }
}
const onVisibility = () => {
  if (document.visibilityState === 'visible' && kiosk.value) requestWakeLock()
}

// ==================== Lifecycle ====================

onMounted(async () => {
  voice.init()
  // Қолданбаның WebView-ында дыбыс басусыз рұқсат етілген
  if (appBridge()) voice.unlock()
  // Экранды кез келген басу дыбысқа рұқсат береді (мобильдіде тек click/touchend жарайды)
  for (const ev of UNLOCK_EVENTS) document.addEventListener(ev, onUserGesture, true)
  tick()
  clockTimer = setInterval(tick, 10_000)
  await loadKioskStatus()
  if (!canScan.value) return
  if (kiosk.value) requestWakeLock()
  document.addEventListener('visibilitychange', onVisibility)
  // Камера мен модельдер қатар: камераға рұқсат сұрауы бірден шығады
  await Promise.all([loadModels(), startCamera()])
  loop()
})

onBeforeUnmount(() => {
  stopped = true
  for (const ev of UNLOCK_EVENTS) document.removeEventListener(ev, onUserGesture, true)
  voice.stop()
  if (clockTimer) clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', onVisibility)
  wakeLock?.release().catch(() => {})
  if (loopTimer) clearTimeout(loopTimer)
  if (videoRef.value?.srcObject) {
    (videoRef.value.srcObject as MediaStream).getTracks().forEach(track => track.stop())
  }
})
</script>
