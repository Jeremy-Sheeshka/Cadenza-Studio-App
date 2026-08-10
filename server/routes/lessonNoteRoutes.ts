import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// GET /api/lesson-notes?student_ids=id1,id2
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { student_ids } = req.query
    if (!student_ids || typeof student_ids !== 'string') {
      res.status(400).json({ error: 'student_ids query param required' }); return
    }
    const ids = student_ids.split(',').filter(Boolean)
    if (ids.length === 0) { res.json({ data: [] }); return }
    const placeholders = ids.map(() => '?').join(',')
    const notes = db.prepare(`SELECT * FROM lesson_notes WHERE student_id IN (${placeholders}) AND status = 'published' ORDER BY updated_at DESC LIMIT 20`).all(...ids)
    res.json({ data: notes })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/lesson-notes — teacher creates a lesson note
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { student_id, title, body, status } = req.body
    if (!student_id || !title) { res.status(400).json({ error: 'student_id and title required' }); return }
    const id = uuidv4()
    db.prepare('INSERT INTO lesson_notes (id, user_id, student_id, title, body, status) VALUES (?,?,?,?,?,?)')
      .run(id, req.user!.id, student_id, title, body || '', status || 'draft')
    const note = db.prepare('SELECT * FROM lesson_notes WHERE id = ?').get(id)
    res.status(201).json({ data: note })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
