import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// GET /api/messages — role-filtered
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const user = req.user!
    let messages: any[]
    if (user.account_type === 'teacher') {
      messages = db.prepare('SELECT * FROM messages WHERE user_id = ? OR sender_type = ? ORDER BY created_at DESC').all(user.id, 'family') as any[]
    } else if (user.account_type === 'family') {
      const family = db.prepare('SELECT id FROM families WHERE user_id = ?').get(user.id) as any
      if (!family) { res.json({ data: [] }); return }
      messages = db.prepare('SELECT * FROM messages WHERE family_id = ? ORDER BY created_at DESC').all(family.id) as any[]
    } else {
      res.json({ data: [] }); return
    }
    res.json({ data: messages })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
});

// POST /api/messages — send message
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const id = uuidv4()
    const { family_id, student_id, body, sender_type } = req.body
    if (!body) { res.status(400).json({ error: 'body required' }); return }
    db.prepare('INSERT INTO messages (id, user_id, family_id, student_id, sender_type, body) VALUES (?,?,?,?,?,?)')
      .run(id, req.user!.id, family_id || null, student_id || null, sender_type || req.user!.account_type, body)
    res.status(201).json({ data: { id } })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
