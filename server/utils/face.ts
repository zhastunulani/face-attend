import { eq, and, isNotNull } from 'drizzle-orm'
import { db } from '~/server/db'
import { employees } from '~/server/db/schema'

// face-api.js (FaceRecognitionNet) 128 өлшемді дескриптор береді.
// Евклид қашықтығы < 0.6 — бір адам деп саналады; біз қатаңырақ шекті қолданамыз.
export const MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD) || 0.45
// Ең жақын екі түрлі адамның қашықтықтары тым жақын болса — нәтиже сенімсіз
const AMBIGUITY_MARGIN = 0.06
// Тіркеу кезінде: басқа қызметкерге осыдан жақын бет — дубликат
const DUPLICATE_THRESHOLD = 0.4
// Бір адамның тіркеу кадрлары бір-біріне осыдан алыс болмауы керек (әйтпесе кадрда басқа адам / нашар сапа)
const ENROLL_CONSISTENCY = 0.42
export const MAX_TEMPLATES = 5

function isVector(arr: unknown): arr is number[] {
  return Array.isArray(arr) && arr.length === 128
    && arr.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 2)
}

/** Бір дескриптор (128 сан) немесе оның JSON жолы */
export function parseDescriptor(value: unknown): number[] | null {
  let arr = value
  if (typeof value === 'string') {
    try {
      arr = JSON.parse(value)
    } catch {
      return null
    }
  }
  return isVector(arr) ? arr : null
}

/**
 * Қызметкердің эталондары. Базада екі формат болуы мүмкін:
 * ескі — бір дескриптор [128 сан], жаңа — бірнеше [[128], [128], ...].
 */
export function parseTemplates(value: unknown): number[][] | null {
  let arr = value
  if (typeof value === 'string') {
    try {
      arr = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (isVector(arr)) return [arr]
  if (Array.isArray(arr) && arr.length >= 1 && arr.length <= MAX_TEMPLATES && arr.every(isVector)) return arr as number[][]
  return null
}

export function euclidean(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

/** Тіркеу кадрлары бір адамдікі әрі тұрақты ма */
export function checkEnrollmentConsistency(templates: number[][]): boolean {
  for (let i = 0; i < templates.length; i++) {
    for (let j = i + 1; j < templates.length; j++) {
      if (euclidean(templates[i], templates[j]) > ENROLL_CONSISTENCY) return false
    }
  }
  return true
}

interface FaceEntry {
  id: number
  name: string
  departmentId: number | null
  scheduleId: number | null
  templates: Float32Array[]
}

let cache: { at: number; entries: FaceEntry[] } | null = null
const CACHE_MS = 60_000

export function invalidateFaceCache() {
  cache = null
}

async function loadFaces(): Promise<FaceEntry[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.entries
  const rows = await db.select({
    id: employees.id,
    name: employees.name,
    departmentId: employees.departmentId,
    scheduleId: employees.scheduleId,
    faceDescriptor: employees.faceDescriptor,
  }).from(employees).where(and(eq(employees.isActive, true), isNotNull(employees.faceDescriptor)))

  const entries: FaceEntry[] = []
  for (const r of rows) {
    const t = parseTemplates(r.faceDescriptor)
    if (t) {
      entries.push({
        id: r.id,
        name: r.name,
        departmentId: r.departmentId,
        scheduleId: r.scheduleId,
        templates: t.map(v => Float32Array.from(v)),
      })
    }
  }
  cache = { at: Date.now(), entries }
  return entries
}

/** Дескриптордан қызметкердің ең жақын эталонына дейінгі қашықтық */
function distanceTo(desc: ArrayLike<number>, e: FaceEntry): number {
  let min = Infinity
  for (const t of e.templates) min = Math.min(min, euclidean(desc, t))
  return min
}

export type MatchResult =
  | { ok: true; employee: FaceEntry; distance: number }
  | { ok: false; reason: 'no_match' | 'ambiguous' | 'inconsistent' }

/**
 * 1:N сәйкестендіру серверде. Бірнеше кадрдың дескрипторлары беріледі:
 * әр кадр бір адамға сәйкес келуі керек, әйтпесе нәтиже қабылданбайды.
 */
export async function matchFace(descriptors: number[][]): Promise<MatchResult> {
  const faces = await loadFaces()
  if (!faces.length) return { ok: false, reason: 'no_match' }

  let matchedId: number | null = null
  let totalDistance = 0

  for (const desc of descriptors) {
    // Әр қызметкер үшін — ең жақын эталоны; содан кейін адамдарды салыстырамыз
    const ranked = faces
      .map(e => ({ e, d: distanceTo(desc, e) }))
      .sort((a, b) => a.d - b.d)
    const best = ranked[0]
    const second = ranked[1]?.d ?? Infinity

    if (best.d >= MATCH_THRESHOLD) return { ok: false, reason: 'no_match' }
    if (second - best.d < AMBIGUITY_MARGIN) return { ok: false, reason: 'ambiguous' }
    if (matchedId !== null && matchedId !== best.e.id) return { ok: false, reason: 'inconsistent' }
    matchedId = best.e.id
    totalDistance += best.d
  }

  const employee = faces.find(f => f.id === matchedId)!
  return { ok: true, employee, distance: totalDistance / descriptors.length }
}

/** Тіркелетін бет (кез келген кадры) басқа қызметкерге тым ұқсас емес пе? */
export async function findDuplicateFace(templates: number[][], exceptEmployeeId?: number) {
  const faces = await loadFaces()
  for (const f of faces) {
    if (f.id === exceptEmployeeId) continue
    if (templates.some(t => distanceTo(t, f) < DUPLICATE_THRESHOLD)) return f
  }
  return null
}
