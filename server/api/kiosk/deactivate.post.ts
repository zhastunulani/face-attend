import { KIOSK_COOKIE } from '~/server/utils/auth'

// Тек осы құрылғыдан cookie-ді өшіреді (киоскіні толық бұғаттау — /api/kiosk/:id DELETE)
export default defineEventHandler(async (event) => {
  deleteCookie(event, KIOSK_COOKIE, { path: '/' })
  return { success: true }
})
