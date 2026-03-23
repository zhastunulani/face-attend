import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ==================== Рөлдер & Қолданушылар ====================

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  login: text('login').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'head', 'manager'] }).notNull().default('manager'),
  departmentId: integer('department_id').references(() => departments.id),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ==================== Ұйым құрылымы ====================

export const departments = sqliteTable('departments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const positions = sqliteTable('positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  departmentId: integer('department_id').references(() => departments.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ==================== Қызметкерлер ====================

export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  departmentId: integer('department_id').references(() => departments.id),
  positionId: integer('position_id').references(() => positions.id),
  photoPath: text('photo_path'),
  faceDescriptor: text('face_descriptor'), // JSON array of 128 floats
  scheduleId: integer('schedule_id').references(() => schedules.id),
  salaryRate: real('salary_rate').notNull().default(0),
  vacationDaysLeft: integer('vacation_days_left').notNull().default(24),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ==================== Жұмыс кестесі ====================

export const schedules = sqliteTable('schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // "5/2 стандарт", "2/2 ауысым", т.б.
  type: text('type', { enum: ['5/2', '2/2', '6/1', 'shift', 'free'] }).notNull(),
  workStart: text('work_start').notNull(), // "09:00"
  workEnd: text('work_end').notNull(), // "18:00"
  workDays: text('work_days').notNull(), // JSON: [1,2,3,4,5] (1=дүйсенбі)
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ==================== Attendance ====================

export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  date: text('date').notNull(), // YYYY-MM-DD
  checkIn: text('check_in'), // HH:MM:SS
  checkOut: text('check_out'), // HH:MM:SS
  checkInPhoto: text('check_in_photo'),
  checkOutPhoto: text('check_out_photo'),
  isLate: integer('is_late', { mode: 'boolean' }).notNull().default(false),
  lateMinutes: integer('late_minutes').notNull().default(0),
  overtimeMinutes: integer('overtime_minutes').notNull().default(0),
  status: text('status', { enum: ['present', 'absent', 'leave', 'sick'] }).notNull().default('present'),
})

// ==================== Демалыс / Больничный ====================

export const leaves = sqliteTable('leaves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  type: text('type', { enum: ['vacation', 'sick', 'maternity', 'other'] }).notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  reason: text('reason'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  approvedBy: integer('approved_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ==================== Айлық ====================

export const salarySettings = sqliteTable('salary_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  baseCurrency: text('base_currency').notNull().default('KZT'),
  overtimeCoefficient: real('overtime_coefficient').notNull().default(1.5),
  weekendCoefficient: real('weekend_coefficient').notNull().default(2.0),
  standardHoursPerDay: integer('standard_hours_per_day').notNull().default(8),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const payroll = sqliteTable('payroll', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  month: integer('month').notNull(), // 1-12
  year: integer('year').notNull(),
  workDays: integer('work_days').notNull().default(0),
  workHours: real('work_hours').notNull().default(0),
  overtimeHours: real('overtime_hours').notNull().default(0),
  baseAmount: real('base_amount').notNull().default(0),
  overtimeAmount: real('overtime_amount').notNull().default(0),
  deductions: real('deductions').notNull().default(0),
  totalAmount: real('total_amount').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ==================== KPI ====================

export const kpiTargets = sqliteTable('kpi_targets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  departmentId: integer('department_id').references(() => departments.id),
  metric: text('metric', { enum: ['attendance_rate', 'overtime_limit', 'late_limit', 'productivity'] }).notNull(),
  targetValue: real('target_value').notNull(),
  period: text('period').notNull(), // "2026-03" (year-month)
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const kpiResults = sqliteTable('kpi_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  departmentId: integer('department_id').references(() => departments.id),
  employeeId: integer('employee_id').references(() => employees.id),
  metric: text('metric').notNull(),
  actualValue: real('actual_value').notNull(),
  period: text('period').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ==================== Overtime ережелері ====================

export const overtimeRules = sqliteTable('overtime_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  thresholdHours: real('threshold_hours').notNull(), // осы сағаттан кейін overtime
  coefficient: real('coefficient').notNull().default(1.5),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ==================== Audit Log ====================

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
