import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, 'data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = path.join(DATA_DIR, 'cadenza-studio.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

export default db

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      account_type TEXT NOT NULL CHECK(account_type IN ('teacher','student','family')),
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      approval_status TEXT DEFAULT 'approved' CHECK(approval_status IN ('pending','approved','rejected')),
      approved_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS teacher_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) UNIQUE,
      display_name TEXT,
      studio_name TEXT,
      onboarding_completed INTEGER DEFAULT 0,
      onboarding_dismissed INTEGER DEFAULT 0,
      onboarding_completed_at TEXT,
      ical_token TEXT,
      student_portal INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      family_id TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      instrument TEXT,
      skill_level TEXT,
      birthday TEXT,
      notes TEXT,
      interests TEXT,
      goals TEXT,
      is_adult INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      makeup_credits INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      family_id TEXT NOT NULL REFERENCES families(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      relationship TEXT,
      is_primary INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      student_id TEXT REFERENCES students(id),
      title TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT DEFAULT 'scheduled',
      is_group INTEGER DEFAULT 0,
      group_name TEXT,
      attendance_status TEXT,
      lesson_notes_summary TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      family_id TEXT REFERENCES families(id),
      invoice_number TEXT,
      title TEXT,
      subtotal INTEGER DEFAULT 0,
      tax INTEGER DEFAULT 0,
      discount INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      balance_due INTEGER DEFAULT 0,
      due_date TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      invoice_id TEXT REFERENCES invoices(id),
      family_id TEXT REFERENCES families(id),
      amount INTEGER NOT NULL,
      payment_method TEXT,
      payment_date TEXT,
      reference_number TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS lesson_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      student_id TEXT REFERENCES students(id),
      title TEXT,
      body TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      folder_name TEXT,
      student_ids TEXT,
      tags TEXT,
      ai_summary TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL,
      body TEXT,
      delivery_status TEXT DEFAULT 'draft',
      recipient_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS practice_logs (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      duration_minutes INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lesson_checkins (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      checked_in_at TEXT DEFAULT (datetime('now')),
      transcription_text TEXT,
      ai_summary TEXT,
      pdf_generated INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      family_id TEXT,
      student_id TEXT,
      sender_type TEXT NOT NULL CHECK(sender_type IN ('teacher','student','family')),
      body TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  console.log('Migrations complete.')
}
