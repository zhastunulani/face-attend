import { randomBytes } from 'node:crypto'

export const ROLES = ['admin', 'head', 'manager'] as const

/** Уақытша құпия сөз: бір рет көрсетіледі, бірінші кіруде ауыстыру міндетті */
export function tempPassword(): string {
  return randomBytes(9).toString('base64url')
}

export const publicUserFields = <T extends Record<string, any>>(u: T) => ({
  id: u.id,
  login: u.login,
  name: u.name,
  role: u.role,
  departmentId: u.departmentId,
  isActive: u.isActive,
  mustChangePassword: u.mustChangePassword,
  createdAt: u.createdAt,
})
