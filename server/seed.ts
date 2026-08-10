import { v4 as uuidv4 } from 'uuid'
import db, { runMigrations } from './db.js'
import { hashPassword } from './auth.js'

export async function seed() {
  runMigrations()

  console.log('Seeding database...')
  
  // Clear existing data (order matters for FK constraints)
  db.exec(`
    DELETE FROM lesson_checkins;
    DELETE FROM practice_logs;
    DELETE FROM messages;
    DELETE FROM broadcasts;
    DELETE FROM payments;
    DELETE FROM invoices;
    DELETE FROM lesson_notes;
    DELETE FROM contacts;
    DELETE FROM events;
    DELETE FROM students;
    DELETE FROM families;
    DELETE FROM resources;
    DELETE FROM teacher_profiles;
    DELETE FROM users;
  `)

  // Create teacher
  const teacherId = uuidv4()
  const teacherHash = await hashPassword('cadenza123')
  db.prepare(
    'INSERT INTO users (id, email, password_hash, account_type, display_name, approval_status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(teacherId, 'teacher@cadenza.local', teacherHash, 'teacher', 'Studio Teacher', 'approved')

  // Create teacher profile
  const profileId = uuidv4()
  db.prepare(
    'INSERT INTO teacher_profiles (id, user_id, display_name, studio_name, onboarding_completed) VALUES (?, ?, ?, ?, ?)'
  ).run(profileId, teacherId, 'Studio Teacher', 'Cadenza Studio', 1)

  // Create 3 sample students
  const students = [
    { first: 'Alice', last: 'Johnson', instrument: 'Piano', skill: 'Beginner', birthday: '2012-05-15' },
    { first: 'Bob', last: 'Smith', instrument: 'Guitar', skill: 'Intermediate', birthday: '2008-11-22' },
    { first: 'Charlie', last: 'Brown', instrument: 'Drums', skill: 'Advanced', birthday: '1998-03-08' }
  ]

  for (const s of students) {
    const studentId = uuidv4()
    db.prepare(
      `INSERT INTO students (id, user_id, first_name, last_name, instrument, skill_level, birthday, interests, goals)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(studentId, teacherId, s.first, s.last, s.instrument, s.skill, s.birthday, 'Music, Performance', 'Improve technique and learn new pieces')
    console.log(`  Created student: ${s.first} ${s.last}`)
  }

  // Create 1 sample family with user account
  const familyUserId = uuidv4()
  const familyHash = await hashPassword('family123')
  db.prepare(
    'INSERT INTO users (id, email, password_hash, account_type, display_name, approval_status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(familyUserId, 'family@cadenza.local', familyHash, 'family', 'The Johnsons', 'approved')

  const familyId = uuidv4()
  db.prepare(
    'INSERT INTO families (id, user_id, name, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(familyId, familyUserId, 'Johnson Family', 'family@cadenza.local', '555-0100', 'Family account for Alice Johnson')

  // Link Alice to the family
  const alice = db.prepare("SELECT id FROM students WHERE first_name = 'Alice' AND last_name = 'Johnson'").get() as any
  if (alice) {
    db.prepare('UPDATE students SET family_id = ? WHERE id = ?').run(familyId, alice.id)
  }

  // Create a contact for the family
  const contactId = uuidv4()
  db.prepare(
    'INSERT INTO contacts (id, user_id, family_id, first_name, last_name, email, phone, relationship, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(contactId, teacherId, familyId, 'Jane', 'Johnson', 'jane@example.com', '555-0101', 'Mother', 1)

  console.log('Seeding complete!')
  console.log('  Teacher: teacher@cadenza.local / cadenza123')
  console.log('  Student: student@cadenza.local / student123')
  console.log('  Family:  family@cadenza.local / family123')
  console.log('  3 students created')

  // ── Create demo student user account ──────────────────────────────────────
  const studentUserId = uuidv4()
  const studentHash = await hashPassword('student123')
  db.prepare(
    'INSERT INTO users (id, email, password_hash, account_type, display_name, approval_status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(studentUserId, 'student@cadenza.local', studentHash, 'student', 'Alice Johnson', 'approved')

  // Create some sample lessons for the student
  const now = new Date()
  for (let i = 0; i < 5; i++) {
    const eventDate = new Date(now)
    eventDate.setDate(now.getDate() + i)
    const dateStr = eventDate.toISOString().slice(0, 10)
    const eventId = uuidv4()
    db.prepare(
      'INSERT INTO events (id, user_id, student_id, title, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(eventId, teacherId, alice?.id ?? null, 'Piano Lesson', `${dateStr}T15:00:00Z`, `${dateStr}T16:00:00Z`, 'scheduled')
  }

  // Create some practice logs for the student
  for (let d = 0; d < 7; d++) {
    const logDate = new Date(now)
    logDate.setDate(now.getDate() - d)
    const logId = uuidv4()
    db.prepare(
      'INSERT INTO practice_logs (id, student_id, user_id, date, duration_minutes, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(logId, alice?.id ?? null, studentUserId, logDate.toISOString().slice(0, 10), 20 + Math.floor(Math.random() * 25), 'Daily practice')
  }

  console.log('  Demo student account created with sample lessons + practice logs')
}

// When run directly (not imported), execute the seed
if (process.argv[1]?.includes('seed')) {
  seed().catch(err => {
    console.error('Seed error:', err)
    process.exit(1)
  })
}
