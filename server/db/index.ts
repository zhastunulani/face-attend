import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import bcryptjs from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/faceattend'

const pool = new pg.Pool({
  connectionString,
  // PGSSL=false — SSL-сіз жергілікті/ішкі база үшін
  ssl: process.env.PGSSL !== 'false' && (connectionString.includes('neon.tech') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false,
})

export { pool }
export const db = drizzle(pool, { schema })

// Кестелерді құру
async function initDatabase() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        department_id INTEGER REFERENCES departments(id),
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        work_start TEXT NOT NULL,
        work_end TEXT NOT NULL,
        work_days TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        department_id INTEGER REFERENCES departments(id),
        position_id INTEGER REFERENCES positions(id),
        photo_path TEXT,
        face_descriptor TEXT,
        schedule_id INTEGER REFERENCES schedules(id),
        salary_rate REAL NOT NULL DEFAULT 0,
        vacation_days_left INTEGER NOT NULL DEFAULT 24,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        login TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'manager',
        department_id INTEGER REFERENCES departments(id),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        date TEXT NOT NULL,
        check_in TEXT,
        check_out TEXT,
        check_in_photo TEXT,
        check_out_photo TEXT,
        is_late BOOLEAN NOT NULL DEFAULT false,
        late_minutes INTEGER NOT NULL DEFAULT 0,
        overtime_minutes INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'present',
        UNIQUE(employee_id, date)
      );

      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS salary_settings (
        id SERIAL PRIMARY KEY,
        base_currency TEXT NOT NULL DEFAULT 'KZT',
        overtime_coefficient REAL NOT NULL DEFAULT 1.5,
        weekend_coefficient REAL NOT NULL DEFAULT 2.0,
        standard_hours_per_day INTEGER NOT NULL DEFAULT 8,
        updated_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS payroll (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        work_days INTEGER NOT NULL DEFAULT 0,
        work_hours REAL NOT NULL DEFAULT 0,
        overtime_hours REAL NOT NULL DEFAULT 0,
        base_amount REAL NOT NULL DEFAULT 0,
        overtime_amount REAL NOT NULL DEFAULT 0,
        deductions REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS kpi_targets (
        id SERIAL PRIMARY KEY,
        department_id INTEGER REFERENCES departments(id),
        metric TEXT NOT NULL,
        target_value REAL NOT NULL,
        period TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS kpi_results (
        id SERIAL PRIMARY KEY,
        department_id INTEGER REFERENCES departments(id),
        employee_id INTEGER REFERENCES employees(id),
        metric TEXT NOT NULL,
        actual_value REAL NOT NULL,
        period TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS overtime_rules (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        threshold_hours REAL NOT NULL,
        coefficient REAL NOT NULL DEFAULT 1.5,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS kiosks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id),
        is_revoked BOOLEAN NOT NULL DEFAULT false,
        last_seen_at TEXT,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        kind TEXT NOT NULL,
        mime TEXT NOT NULL,
        data BYTEA NOT NULL,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );

      -- Миграциялар (бұрынғы базаларға жаңа бағандар)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS source TEXT;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS match_distance REAL;
      ALTER TABLE payroll ADD COLUMN IF NOT EXISTS regular_hours REAL NOT NULL DEFAULT 0;
      ALTER TABLE payroll ADD COLUMN IF NOT EXISTS weekend_hours REAL NOT NULL DEFAULT 0;
      ALTER TABLE payroll ADD COLUMN IF NOT EXISTS weekend_amount REAL NOT NULL DEFAULT 0;
      ALTER TABLE payroll ADD COLUMN IF NOT EXISTS planned_days INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'auto';
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS note TEXT;

      CREATE TABLE IF NOT EXISTS holidays (
        date TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (now()::text)
      );
    `)

    // Payroll: бір қызметкерге бір айда бір жазба
    try {
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS payroll_employee_period ON payroll (employee_id, year, month)')
    } catch (e) {
      console.warn('payroll unique index was not created (duplicates exist?):', (e as Error).message)
    }

    // Seed: default departments
    const deptCheck = await client.query('SELECT id FROM departments LIMIT 1')
    if (deptCheck.rows.length === 0) {
      await client.query("INSERT INTO departments (name) VALUES ('IT бөлімі'), ('Бухгалтерия'), ('HR бөлімі')")
    }

    await seedUsers(client)
    await seedHolidays(client)

    // Seed: default salary settings
    const settingsCheck = await client.query('SELECT id FROM salary_settings LIMIT 1')
    if (settingsCheck.rows.length === 0) {
      await client.query('INSERT INTO salary_settings (base_currency, overtime_coefficient, weekend_coefficient, standard_hours_per_day) VALUES ($1, $2, $3, $4)', ['KZT', 1.5, 2.0, 8])
    }

    // Seed: default schedule
    const scheduleCheck = await client.query('SELECT id FROM schedules LIMIT 1')
    if (scheduleCheck.rows.length === 0) {
      await client.query('INSERT INTO schedules (name, type, work_start, work_end, work_days) VALUES ($1, $2, $3, $4, $5)', ['Стандарт 5/2', '5/2', '09:00', '18:00', JSON.stringify([1, 2, 3, 4, 5])])
    }

    // Seed: default overtime rule
    const ruleCheck = await client.query('SELECT id FROM overtime_rules LIMIT 1')
    if (ruleCheck.rows.length === 0) {
      await client.query('INSERT INTO overtime_rules (name, threshold_hours, coefficient) VALUES ($1, $2, $3)', ['Стандарт', 8, 1.5])
    }

    console.log('Database initialized successfully')
  } finally {
    client.release()
  }
}

// ҚР Еңбек кодексі / «Мерекелер туралы» заң: күні тұрақты мерекелер.
// Құрбан айт (күні жыл сайын өзгереді) және Үкімет қаулысымен ауыстырылатын демалыс күндері
// Баптаулардан қолмен қосылады.
const KZ_FIXED_HOLIDAYS: [string, string][] = [
  ['01-01', 'Жаңа жыл'], ['01-02', 'Жаңа жыл'], ['01-07', 'Православиелік Рождество'],
  ['03-08', 'Халықаралық әйелдер күні'], ['03-21', 'Наурыз мейрамы'], ['03-22', 'Наурыз мейрамы'],
  ['03-23', 'Наурыз мейрамы'], ['05-01', 'Қазақстан халқының бірлігі мерекесі'],
  ['05-07', 'Отан қорғаушы күні'], ['05-09', 'Жеңіс күні'], ['07-06', 'Астана күні'],
  ['08-30', 'Конституция күні'], ['10-25', 'Республика күні'], ['12-16', 'Тәуелсіздік күні'],
]

async function seedHolidays(client: pg.PoolClient) {
  // Әр жылға бір рет: ағымдағы және келесі жыл (бар күндер қайта жазылмайды, жойылғандары қайтпайды)
  const year = new Date().getUTCFullYear()
  for (const y of [year, year + 1]) {
    const seeded = await client.query("SELECT 1 FROM audit_log WHERE action = 'holidays_seeded' AND details = $1", [String(y)])
    if (seeded.rows.length) continue
    for (const [md, name] of KZ_FIXED_HOLIDAYS) {
      await client.query('INSERT INTO holidays (date, name) VALUES ($1, $2) ON CONFLICT (date) DO NOTHING', [`${y}-${md}`, name])
    }
    await client.query("INSERT INTO audit_log (action, details) VALUES ('holidays_seeded', $1)", [String(y)])
  }
}

const DEFAULT_PASSWORDS: Record<string, string> = { admin: 'admin123', head: 'head123', manager: 'manager123' }

async function seedUsers(client: pg.PoolClient) {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM users')
  if (rows[0].n === 0) {
    // Алғашқы іске қосу: admin құпия сөзі env-тен немесе кездейсоқ
    const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url')
    const hash = await bcryptjs.hash(password, 10)
    await client.query(
      'INSERT INTO users (login, password, name, role, must_change_password) VALUES ($1, $2, $3, $4, $5)',
      ['admin', hash, 'Администратор', 'admin', true],
    )
    if (!process.env.ADMIN_PASSWORD) {
      console.warn(`[face-attend] Created user "admin" with one-time password: ${password} (change it after first login)`)
    }
    if (process.env.SEED_DEMO_USERS === 'true') {
      for (const [login, name, role, dept] of [['head', 'Бөлім басшысы', 'head', 1], ['manager', 'Менеджер', 'manager', null]] as const) {
        const h = await bcryptjs.hash(DEFAULT_PASSWORDS[login], 10)
        await client.query(
          'INSERT INTO users (login, password, name, role, department_id, must_change_password) VALUES ($1, $2, $3, $4, $5, true) ON CONFLICT (login) DO NOTHING',
          [login, h, name, role, dept],
        )
      }
    }
    return
  }

  // Бұрынғы нұсқа жасаған стандарт құпия сөздер: ауыстыруды міндеттейміз
  const existing = await client.query(
    'SELECT id, login, password FROM users WHERE login = ANY($1) AND must_change_password = false',
    [Object.keys(DEFAULT_PASSWORDS)],
  )
  for (const u of existing.rows) {
    if (await bcryptjs.compare(DEFAULT_PASSWORDS[u.login], u.password)) {
      await client.query('UPDATE users SET must_change_password = true WHERE id = $1', [u.id])
      console.warn(`[face-attend] User "${u.login}" still uses the default password - password change is now required`)
    }
  }
}

// Инициализация бір рет орындалады; сәтсіз болса (мысалы, Neon "ұйықтап" тұр) —
// келесі сұраныста қайта әрекет жасалады, сервер қайта іске қосуды қажет етпейді.
let ready: Promise<void> | null = null
export function ensureDb(): Promise<void> {
  if (!ready) {
    ready = initDatabase().catch((error) => {
      console.error('Database initialization error:', error)
      ready = null
      throw error
    })
  }
  return ready
}
ensureDb().catch(() => {})

export default db
