import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigrations } from './db.js'
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
const PORT = parseInt(process.env.PORT || '3001')

// In production, allow the deployed domain; in dev, allow localhost
const isProd = process.env.NODE_ENV === 'production'
app.use(cors({
  origin: isProd
    ? [process.env.RAILWAY_PUBLIC_DOMAIN || '*']
    : ['http://localhost:5173', 'http://localhost:5199', 'http://localhost:3000']
}))
app.use(express.json())

runMigrations()

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

// Serve React frontend in production
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => console.log(`Cadenza Studio server running on http://localhost:${PORT}`))

export default app
