import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// GET /api/practice-summary?student_ids=id1,id2&week_start=2026-01-01
router.get('/summary', authMiddleware, (req: Request, res: Response) => {
  try {
    const { student_ids, week_start } = req.query
    if (!student_ids || typeof student_ids !== 'string') {
      res.status(400).json({ error: 'student_ids required' }); return
    }
    const ids = student_ids.split(',').filter(Boolean)
    if (ids.length === 0) { res.json({ data: [] }); return }
    
    const weekStart = typeof week_start === 'string' ? week_start : new Date().toISOString().slice(0, 10)
    const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString().slice(0, 10)
    
    const placeholders = ids.map(() => '?').join(',')
    const logs = db.prepare(`SELECT student_id, SUM(duration_minutes) as total_minutes, COUNT(*) as session_count FROM practice_logs WHERE student_id IN (${placeholders}) AND date >= ? AND date < ? GROUP BY student_id`).all(...ids, weekStart, weekEnd) as any[]
    
    res.json({ data: logs })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/practice — log practice session
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { student_id, date, duration_minutes, notes } = req.body
    if (!student_id || !date) { res.status(400).json({ error: 'student_id and date required' }); return }
    const id = uuidv4()
    db.prepare('INSERT INTO practice_logs (id, student_id, user_id, date, duration_minutes, notes) VALUES (?,?,?,?,?,?)')
      .run(id, student_id, req.user!.id, date, duration_minutes || 0, notes || '')
    res.status(201).json({ data: { id } })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
