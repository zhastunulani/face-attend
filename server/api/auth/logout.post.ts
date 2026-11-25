import { AUTH_COOKIE } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
  return { success: true }
})
