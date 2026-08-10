import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import db from '../db.js'
import { authMiddleware, requireRole } from '../auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '..', 'data', 'uploads')

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, unique)
  }
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

const router = Router()

// GET /api/resources
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM resources WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.id)
    res.json({ data: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/resources/upload
router.post('/upload', authMiddleware, requireRole('teacher'), upload.single('file'), (req: Request, res: Response) => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const id = uuidv4()
    const { folder_name, student_ids, tags } = req.body

    db.prepare(
      `INSERT INTO resources (id, user_id, name, file_path, file_size, mime_type, folder_name, student_ids, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, req.user!.id,
      file.originalname,
      file.filename,
      file.size,
      file.mimetype,
      folder_name || null,
      student_ids || null,
      tags || null
    )

    const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(id)
    res.status(201).json({ data: resource })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/resources/search?q=
router.get('/search', authMiddleware, (req: Request, res: Response) => {
  try {
    const q = req.query.q as string
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' })
      return
    }

    const rows = db.prepare(
      'SELECT * FROM resources WHERE user_id = ? AND (name LIKE ? OR tags LIKE ?) ORDER BY created_at DESC'
    ).all(req.user!.id, `%${q}%`, `%${q}%`)

    res.json({ data: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/resources/:id/download
router.get('/:id/download', authMiddleware, (req: Request, res: Response) => {
  try {
    const resource = db.prepare('SELECT * FROM resources WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any
    if (!resource) {
      res.status(404).json({ error: 'Resource not found' })
      return
    }

    const filePath = path.join(UPLOADS_DIR, resource.file_path)
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' })
      return
    }

    res.download(filePath, resource.name)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
