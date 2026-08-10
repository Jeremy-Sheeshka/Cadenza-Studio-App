import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { authMiddleware, requireRole } from '../auth.js'

const router = Router()

// GET /api/students
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const user = req.user!
    let rows: any[]

    if (user.account_type === 'teacher') {
      rows = db.prepare('SELECT * FROM students WHERE user_id = ?').all(user.id)
    } else if (user.account_type === 'student') {
      rows = db.prepare('SELECT * FROM students WHERE user_id = ?').all(user.id)
    } else if (user.account_type === 'family') {
      const family = db.prepare('SELECT id FROM families WHERE user_id = ?').get(user.id) as any
      if (family) {
        rows = db.prepare('SELECT * FROM students WHERE family_id = ?').all(family.id)
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

// POST /api/students
router.post('/', authMiddleware, requireRole('teacher'), (req: Request, res: Response) => {
  try {
    const { family_id, first_name, last_name, instrument, skill_level, birthday, notes, interests, goals, is_adult, status, makeup_credits } = req.body

    if (!first_name || !last_name) {
      res.status(400).json({ error: 'first_name and last_name are required' })
      return
    }

    const id = uuidv4()
    db.prepare(
      `INSERT INTO students (id, user_id, family_id, first_name, last_name, instrument, skill_level, birthday, notes, interests, goals, is_adult, status, makeup_credits)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, req.user!.id,
      family_id || null,
      first_name, last_name,
      instrument || null,
      skill_level || null,
      birthday || null,
      notes || null,
      interests || null,
      goals || null,
      is_adult ? 1 : 0,
      status || 'active',
      makeup_credits || 0
    )

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id)
    res.status(201).json({ data: student })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/students/:id
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id) as any
    if (!student) {
      res.status(404).json({ error: 'Student not found' })
      return
    }

    const user = req.user!
    // Authorization: teacher who owns, the student themselves, or family who owns
    if (user.account_type === 'teacher' && student.user_id !== user.id) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    if (user.account_type === 'student' && student.user_id !== user.id) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    if (user.account_type === 'family') {
      const family = db.prepare('SELECT id FROM families WHERE user_id = ?').get(user.id) as any
      if (!family || student.family_id !== family.id) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
    }

    res.json({ data: student })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/students/:id
router.patch('/:id', authMiddleware, requireRole('teacher'), (req: Request, res: Response) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any
    if (!student) {
      res.status(404).json({ error: 'Student not found' })
      return
    }

    const fields = ['family_id', 'first_name', 'last_name', 'instrument', 'skill_level', 'birthday', 'notes', 'interests', 'goals', 'is_adult', 'status', 'makeup_credits']
    const updates: string[] = []
    const values: any[] = []

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`)
        if (field === 'is_adult') {
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
    db.prepare(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id)
    res.json({ data: updated })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
