// Сброс пароля пользователя FaceAttend (база Neon, ветка production).
//   node deploy/reset-password.mjs admin
// Генерирует временный пароль, показывает его ТОЛЬКО в этом терминале и требует сменить при первом входе.
// Все сессии этого пользователя на других устройствах завершаются.
// Нужен Neon CLI после `neon login` (строка подключения берётся через него и нигде не выводится).
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pg = require('pg')
const bcrypt = require('bcryptjs')

const login = process.argv[2]
if (!login) {
  console.error('Использование: node deploy/reset-password.mjs <логин>')
  process.exit(1)
}

const projectId = process.env.NEON_PROJECT_ID || 'little-lab-29526625'
const url = execSync(
  `neon connection-string ${process.env.NEON_BRANCH || 'production'} --project-id ${projectId} --database-name neondb --pooled`,
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim().replace('sslmode=require', 'sslmode=verify-full')

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  const password = randomBytes(9).toString('base64url') // 12 символов
  const hash = await bcrypt.hash(password, 10)
  const res = await client.query(
    `UPDATE users
        SET password = $1, must_change_password = true, token_version = token_version + 1, is_active = true
      WHERE login = $2
      RETURNING login, role`,
    [hash, login],
  )
  if (!res.rowCount) {
    const all = await client.query('SELECT login FROM users ORDER BY id')
    console.error(`Пользователь "${login}" не найден. Есть: ${all.rows.map(r => r.login).join(', ')}`)
    process.exitCode = 1
  } else {
    await client.query(
      'INSERT INTO audit_log (user_id, action, details) SELECT id, $2, $3 FROM users WHERE login = $1',
      [login, 'password_reset_cli', JSON.stringify({ by: 'deploy/reset-password.mjs' })],
    )
    console.log(`\nПользователь: ${login} (${res.rows[0].role})`)
    console.log(`Временный пароль: ${password}`)
    console.log('Вход: https://face-attent.zhastunulani.kz/login — сразу после входа система попросит задать свой пароль.\n')
  }
} finally {
  await client.end()
}
