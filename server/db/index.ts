import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'
import bcryptjs from 'bcryptjs'
import * as schema from './schema'

const dataDir = resolve(process.cwd(), 'data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const sqlite = new Database(resolve(dataDir, 'face-attend.db'))
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

// Кестелерді құру
function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('5/2','2/2','6/1','shift','free')),
      work_start TEXT NOT NULL,
      work_end TEXT NOT NULL,
      work_days TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      position_id INTEGER REFERENCES positions(id),
      photo_path TEXT,
      face_descriptor TEXT,
      schedule_id INTEGER REFERENCES schedules(id),
      salary_rate REAL NOT NULL DEFAULT 0,
      vacation_days_left INTEGER NOT NULL DEFAULT 24,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'manager' CHECK(role IN ('admin','head','manager')),
      department_id INTEGER REFERENCES departments(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      check_in_photo TEXT,
      check_out_photo TEXT,
      is_late INTEGER NOT NULL DEFAULT 0,
      late_minutes INTEGER NOT NULL DEFAULT 0,
      overtime_minutes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present','absent','leave','sick')),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      type TEXT NOT NULL CHECK(type IN ('vacation','sick','maternity','other')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      approved_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS salary_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_currency TEXT NOT NULL DEFAULT 'KZT',
      overtime_coefficient REAL NOT NULL DEFAULT 1.5,
      weekend_coefficient REAL NOT NULL DEFAULT 2.0,
      standard_hours_per_day INTEGER NOT NULL DEFAULT 8,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kpi_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER REFERENCES departments(id),
      metric TEXT NOT NULL CHECK(metric IN ('attendance_rate','overtime_limit','late_limit','productivity')),
      target_value REAL NOT NULL,
      period TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kpi_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER REFERENCES departments(id),
      employee_id INTEGER REFERENCES employees(id),
      metric TEXT NOT NULL,
      actual_value REAL NOT NULL,
      period TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS overtime_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      threshold_hours REAL NOT NULL,
      coefficient REAL NOT NULL DEFAULT 1.5,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Seed: default admin
  const adminExists = sqlite.prepare('SELECT id FROM users WHERE login = ?').get('admin')
  if (!adminExists) {
    const hash = bcryptjs.hashSync('admin123', 10)
    sqlite.prepare('INSERT INTO users (login, password, name, role) VALUES (?, ?, ?, ?)').run('admin', hash, 'Администратор', 'admin')
  }

  // Seed: default departments
  const deptExists = sqlite.prepare('SELECT id FROM departments LIMIT 1').get()
  if (!deptExists) {
    sqlite.prepare('INSERT INTO departments (name) VALUES (?)').run('IT бөлімі')
    sqlite.prepare('INSERT INTO departments (name) VALUES (?)').run('Бухгалтерия')
    sqlite.prepare('INSERT INTO departments (name) VALUES (?)').run('HR бөлімі')
  }

  // Seed: head user (бөлім басшысы)
  const headExists = sqlite.prepare('SELECT id FROM users WHERE login = ?').get('head')
  if (!headExists) {
    const hash = bcryptjs.hashSync('head123', 10)
    sqlite.prepare('INSERT INTO users (login, password, name, role, department_id) VALUES (?, ?, ?, ?, ?)').run('head', hash, 'Бөлім басшысы', 'head', 1)
  }

  // Seed: manager user
  const managerExists = sqlite.prepare('SELECT id FROM users WHERE login = ?').get('manager')
  if (!managerExists) {
    const hash = bcryptjs.hashSync('manager123', 10)
    sqlite.prepare('INSERT INTO users (login, password, name, role) VALUES (?, ?, ?, ?)').run('manager', hash, 'Менеджер', 'manager')
  }

  // Seed: default salary settings
  const settingsExist = sqlite.prepare('SELECT id FROM salary_settings LIMIT 1').get()
  if (!settingsExist) {
    sqlite.prepare('INSERT INTO salary_settings (base_currency, overtime_coefficient, weekend_coefficient, standard_hours_per_day) VALUES (?, ?, ?, ?)').run('KZT', 1.5, 2.0, 8)
  }

  // Seed: default schedule
  const scheduleExists = sqlite.prepare('SELECT id FROM schedules LIMIT 1').get()
  if (!scheduleExists) {
    sqlite.prepare('INSERT INTO schedules (name, type, work_start, work_end, work_days) VALUES (?, ?, ?, ?, ?)').run('Стандарт 5/2', '5/2', '09:00', '18:00', JSON.stringify([1, 2, 3, 4, 5]))
  }

  // Seed: default overtime rule
  const ruleExists = sqlite.prepare('SELECT id FROM overtime_rules LIMIT 1').get()
  if (!ruleExists) {
    sqlite.prepare('INSERT INTO overtime_rules (name, threshold_hours, coefficient) VALUES (?, ?, ?)').run('Стандарт', 8, 1.5)
  }
}

initDatabase()

export default db
