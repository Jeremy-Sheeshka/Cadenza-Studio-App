import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { hashPassword, verifyPassword, generateToken, authMiddleware, requireRole, type JwtPayload } from '../auth.js'

const router = Router()

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, account_type, display_name } = req.body

    if (!email || !password || !account_type || !display_name) {
      res.status(400).json({ error: 'Missing required fields: email, password, account_type, display_name' })
      return
    }

    if (!['teacher', 'student', 'family'].includes(account_type)) {
      res.status(400).json({ error: 'Invalid account_type' })
      return
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const id = uuidv4()
    const password_hash = await hashPassword(password)
    const approval_status = account_type === 'teacher' ? 'approved' : 'pending'

    db.prepare(
      'INSERT INTO users (id, email, password_hash, account_type, display_name, approval_status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, email, password_hash, account_type, display_name, approval_status)

    const user: JwtPayload = { id, email, account_type: account_type as JwtPayload['account_type'], display_name }
    const token = generateToken(user)

    res.status(201).json({
      data: { token, user: { id, email, account_type, display_name, approval_status } }
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Missing email or password' })
      return
    }

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
    if (!row) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const valid = await verifyPassword(password, row.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    if (row.approval_status !== 'approved') {
      res.status(403).json({ error: 'Account pending approval' })
      return
    }

    const user: JwtPayload = {
      id: row.id,
      email: row.email,
      account_type: row.account_type,
      display_name: row.display_name
    }
    const token = generateToken(user)

    res.json({
      data: {
        token,
        user: {
          id: row.id,
          email: row.email,
          account_type: row.account_type,
          display_name: row.display_name,
          approval_status: row.approval_status
        }
      }
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', (req: Request, res: Response) => {
  res.json({ data: { message: 'If account exists, reset link sent' } })
})

// GET /api/auth/me
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  const row = db.prepare('SELECT id, email, account_type, display_name, approval_status FROM users WHERE id = ?').get(req.user!.id) as any
  if (!row) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  // Attach the linked family so the family portal can resolve it directly.
  if (row.account_type === 'family') {
    const family = db.prepare('SELECT * FROM families WHERE user_id = ?').get(row.id) as any
    if (family) row.family = family
  }
  res.json({ data: row })
})

// GET /api/auth/pending-approvals
router.get('/pending-approvals', authMiddleware, requireRole('teacher'), (req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT id, email, account_type, display_name, approval_status, created_at FROM users WHERE approval_status = ?'
  ).all('pending')
  res.json({ data: rows })
})

// POST /api/auth/approve/:id
router.post('/approve/:id', authMiddleware, requireRole('teacher'), (req: Request, res: Response) => {
  const { id } = req.params
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  db.prepare('UPDATE users SET approval_status = ?, approved_by = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run('approved', req.user!.id, id)

  res.json({ data: { message: 'User approved', id } })
})

export default router
