import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware, requireRole } from '../auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// GET /api/families/:id — get family by ID (teacher or that family)
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id) as any
    if (!family) { res.status(404).json({ error: 'Family not found' }); return }
    // Check access: teacher can see any, family can only see their own
    if (req.user!.account_type === 'family' && family.user_id !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    res.json({ data: family })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/families/:id/students
router.get('/:id/students', authMiddleware, (req: Request, res: Response) => {
  try {
    const students = db.prepare('SELECT * FROM students WHERE family_id = ?').all(req.params.id)
    res.json({ data: students })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/families/:id/invoices
router.get('/:id/invoices', authMiddleware, (req: Request, res: Response) => {
  try {
    const invoices = db.prepare('SELECT * FROM invoices WHERE family_id = ? ORDER BY created_at DESC').all(req.params.id)
    res.json({ data: invoices })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/families/:id/payments
router.get('/:id/payments', authMiddleware, (req: Request, res: Response) => {
  try {
    const payments = db.prepare('SELECT * FROM payments WHERE family_id = ? ORDER BY payment_date DESC').all(req.params.id)
    res.json({ data: payments })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/families/:id/messages
router.get('/:id/messages', authMiddleware, (req: Request, res: Response) => {
  try {
    const messages = db.prepare('SELECT * FROM messages WHERE family_id = ? ORDER BY created_at DESC').all(req.params.id)
    res.json({ data: messages })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/families/:id/activity — recent activity feed
router.get('/:id/activity', authMiddleware, (req: Request, res: Response) => {
  try {
    const familyId = req.params.id
    // Get student IDs for this family
    const studentRows = db.prepare('SELECT id FROM students WHERE family_id = ?').all(familyId) as any[]
    const studentIds = studentRows.map(s => s.id)
    
    const activity: any[] = []
    
    // Recent lesson notes
    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(',')
      const notes = db.prepare(`SELECT id, student_id, title, status, updated_at, 'lesson_note' as type FROM lesson_notes WHERE student_id IN (${placeholders}) ORDER BY updated_at DESC LIMIT 5`).all(...studentIds) as any[]
      activity.push(...notes)
    }
    
    // Recent invoices
    const invoices = db.prepare("SELECT id, invoice_number as title, status, created_at as updated_at, 'invoice' as type FROM invoices WHERE family_id = ? ORDER BY created_at DESC LIMIT 3").all(familyId) as any[]
    activity.push(...invoices)
    
    // Recent payments
    const payments = db.prepare("SELECT id, reference_number as title, amount, payment_date as updated_at, 'payment' as type FROM payments WHERE family_id = ? ORDER BY payment_date DESC LIMIT 3").all(familyId) as any[]
    activity.push(...payments)
    
    // Sort by date descending
    activity.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    
    res.json({ data: activity.slice(0, 10) })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
