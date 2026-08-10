import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../auth.js'

const router = Router()

// POST /api/ai/summarize-lesson
router.post('/summarize-lesson', authMiddleware, (req: Request, res: Response) => {
  try {
    const { event_id, transcript } = req.body

    if (!event_id || !transcript) {
      res.status(400).json({ error: 'event_id and transcript are required' })
      return
    }

    // Mock summary - Ollama not configured
    const wordCount = transcript.split(/\s+/).length
    const mockSummary = `[Mock AI Summary] This lesson transcript contains ${wordCount} words. Key topics appear to include music instruction. To enable real AI summaries, install Ollama and run: ollama pull llama3.2:3b`

    res.json({
      data: {
        event_id,
        summary: mockSummary,
        model: 'mock/ollama-not-configured',
        note: 'Ollama is not configured. Install Ollama and pull llama3.2:3b for real summaries.'
      }
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/search-library
router.post('/search-library', authMiddleware, (req: Request, res: Response) => {
  try {
    const { query } = req.body

    if (!query) {
      res.status(400).json({ error: 'query is required' })
      return
    }

    const rows = db.prepare(
      'SELECT * FROM resources WHERE user_id = ? AND (name LIKE ? OR tags LIKE ? OR ai_summary LIKE ?) ORDER BY created_at DESC LIMIT 20'
    ).all(req.user!.id, `%${query}%`, `%${query}%`, `%${query}%`)

    res.json({ data: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/ai/status
router.get('/status', authMiddleware, (_req: Request, res: Response) => {
  res.json({
    data: {
      ollama_available: false,
      model: 'llama-3.2-3b',
      status: 'offline',
      message: 'Install Ollama and run: ollama pull llama3.2:3b'
    }
  })
})

export default router
