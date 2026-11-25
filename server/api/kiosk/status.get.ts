import { getKiosk, getAuthUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const kiosk = await getKiosk(event)
  const user = await getAuthUser(event)
  return {
    kiosk: kiosk ? { id: kiosk.id, name: kiosk.name, mode: kiosk.mode } : null,
    canActivate: !!user && !user.mustChangePassword && (user.role === 'admin' || user.role === 'head'),
  }
})
