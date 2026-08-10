import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigrations } from './db.js'
import { seed } from './seed.js'
import authRoutes from './routes/authRoutes.js'
import studentRoutes from './routes/studentRoutes.js'
import eventRoutes from './routes/eventRoutes.js'
import resourceRoutes from './routes/resourceRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import familyRoutes from './routes/familyRoutes.js'
import lessonNoteRoutes from './routes/lessonNoteRoutes.js'
import practiceRoutes from './routes/practiceRoutes.js'
import invoiceRoutes from './routes/invoiceRoutes.js'
import messageRoutes from './routes/messageRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://cadenza-studio-app-production.up.railway.app',
  ],
  credentials: true,
}))
app.use(express.json())

runMigrations()

// Only seed if RUN_SEED=true (prevents re-seeding on every restart)
if (process.env.RUN_SEED === 'true') {
  seed().catch(err => {
    console.error('Seed error:', err)
  })
}

app.use('/api/auth', authRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/resources', resourceRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/families', familyRoutes)
app.use('/api/lesson-notes', lessonNoteRoutes)
app.use('/api/practice', practiceRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/messages', messageRoutes)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// Serve React frontend (if dist/ exists, serve it)
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => console.log(`Cadenza Studio server running on port ${PORT}`))

export default app
