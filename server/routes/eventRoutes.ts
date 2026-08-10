import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { authMiddleware, requireRole } from '../auth.js'

const router = Router()

// GET /api/events
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const user = req.user!
    let rows: any[]

    if (user.account_type === 'teacher') {
      rows = db.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY start_time DESC').all(user.id)
    } else if (user.account_type === 'student') {
      const students = db.prepare('SELECT id FROM students WHERE user_id = ?').all(user.id) as any[]
      const studentIds = students.map(s => s.id)
      if (studentIds.length > 0) {
        const placeholders = studentIds.map(() => '?').join(',')
        rows = db.prepare(`SELECT * FROM events WHERE student_id IN (${placeholders}) ORDER BY start_time DESC`).all(...studentIds)
      } else {
        rows = []
      }
    } else if (user.account_type === 'family') {
      const family = db.prepare('SELECT id FROM families WHERE user_id = ?').get(user.id) as any
      if (family) {
        const students = db.prepare('SELECT id FROM students WHERE family_id = ?').all(family.id) as any[]
        const studentIds = students.map(s => s.id)
        if (studentIds.length > 0) {
          const placeholders = studentIds.map(() => '?').join(',')
          rows = db.prepare(`SELECT * FROM events WHERE student_id IN (${placeholders}) ORDER BY start_time DESC`).all(...studentIds)
        } else {
          rows = []
        }
      } else {
        rows = []
      }
    } else {
      rows = []
    }

    res.json({ data: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/events
router.post('/', authMiddleware, requireRole('teacher'), (req: Request, res: Response) => {
  try {
    const { student_id, title, start_time, end_time, status, is_group, group_name } = req.body

    if (!start_time || !end_time) {
      res.status(400).json({ error: 'start_time and end_time are required' })
      return
    }

    const id = uuidv4()
    db.prepare(
      `INSERT INTO events (id, user_id, student_id, title, start_time, end_time, status, is_group, group_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, req.user!.id,
      student_id || null,
      title || null,
      start_time, end_time,
      status || 'scheduled',
      is_group ? 1 : 0,
      group_name || null
    )

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id)
    res.status(201).json({ data: event })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/events/:id/checkin
router.post('/:id/checkin', authMiddleware, (req: Request, res: Response) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as any
    if (!event) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    const checkinId = uuidv4()
    db.prepare(
      'INSERT INTO lesson_checkins (id, event_id, student_id) VALUES (?, ?, ?)'
    ).run(checkinId, event.id, event.student_id)

    const checkin = db.prepare('SELECT * FROM lesson_checkins WHERE id = ?').get(checkinId)
    res.status(201).json({ data: checkin })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/events/:id
router.patch('/:id', authMiddleware, requireRole('teacher'), (req: Request, res: Response) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any
    if (!event) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    const fields = ['student_id', 'title', 'start_time', 'end_time', 'status', 'is_group', 'group_name', 'attendance_status', 'lesson_notes_summary']
    const updates: string[] = []
    const values: any[] = []

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'is_group') {
          values.push(req.body[field] ? 1 : 0)
        } else {
          values.push(req.body[field])
        }
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    values.push(req.params.id)
    db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
    res.json({ data: updated })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
