import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware, requireRole } from '../auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// GET /api/invoices — teacher sees all, family sees their family's, student sees none
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const user = req.user!
    let invoices: any[]
    if (user.account_type === 'teacher') {
      invoices = db.prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC').all(user.id) as any[]
    } else if (user.account_type === 'family') {
      const family = db.prepare('SELECT id FROM families WHERE user_id = ?').get(user.id) as any
      if (!family) { res.json({ data: [] }); return }
      invoices = db.prepare('SELECT * FROM invoices WHERE family_id = ? ORDER BY created_at DESC').all(family.id) as any[]
    } else {
      res.json({ data: [] }); return
    }
    res.json({ data: invoices })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/invoices — teacher creates invoice
router.post('/', authMiddleware, requireRole('teacher'), (req: Request, res: Response) => {
  try {
    const id = uuidv4()
    const { family_id, title, subtotal, tax, discount, total, balance_due, due_date, status, invoice_number } = req.body
    db.prepare(`INSERT INTO invoices (id, user_id, family_id, invoice_number, title, subtotal, tax, discount, total, balance_due, due_date, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user!.id, family_id || null, invoice_number || `INV-${Date.now()}`, title || 'Invoice', subtotal || 0, tax || 0, discount || 0, total || 0, balance_due || total || 0, due_date || null, status || 'draft')
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)
    res.status(201).json({ data: invoice })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
