// Local AI assistant engine — deterministic and retrieval-augmented over the
// studio's own data (students, families, events, lesson notes, invoices,
// resources, practice). Runs fully offline against the in-memory mock; the
// intent handlers are the "RAG" layer: they pull the relevant rows and compose
// a grounded answer. Swap in an Ollama/LLM call later without changing the UI.

import {
  getStudents, getEvents, getInvoices, getResources,
  getPracticeSummaries, db,
} from './api'
import type { Student, CalendarEvent, Invoice, Resource, LessonNote, WeeklyPracticeSummary } from './types'

const USER_ID = '56d5b457-8b27-43a2-8b21-74c88944759e'
const STUDIO = 'Cadenza Studio'

export interface AssistantReply {
  text: string
  sources: string[]
}

export const SUGGESTED_PROMPTS = [
  'How many students do I have?',
  "What's on my schedule this week?",
  'Summarize my lesson notes',
  'Draft a message to Sofia',
  'Any outstanding invoices?',
  'Search my library for scales',
]

// ── formatting helpers ──────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const fmtDay = (iso: string) => `${DAYS[new Date(iso).getDay()]} ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`

function noteText(note: LessonNote): string {
  const body = note.body as { content?: { content?: { text?: string }[] }[] } | null
  return body?.content?.map((p) => p.content?.map((c) => c.text ?? '').join(' ')).join(' ') ?? ''
}

// ── retrieval layer ─────────────────────────────────────────────────────────

async function roster(): Promise<Student[]> { return (await getStudents()) ?? [] }

async function thisWeekEvents(): Promise<CalendarEvent[]> {
  const now = new Date()
  const ws = new Date(now)
  ws.setDate(ws.getDate() - now.getDay())
  ws.setHours(0, 0, 0, 0)
  const we = new Date(ws)
  we.setDate(we.getDate() + 7)
  return (await getEvents(ws.toISOString(), we.toISOString())) ?? []
}

async function allInvoices(): Promise<Invoice[]> { return (await getInvoices()) ?? [] }
async function library(): Promise<Resource[]> { return (await getResources()) ?? [] }

async function lessonNotes(): Promise<LessonNote[]> {
  const { data } = await db.from('lesson_notes')
    .select('*,student:students(first_name,last_name)')
    .eq('user_id', USER_ID)
    .order('lesson_date', { ascending: false })
    .limit(50)
  return (data ?? []) as LessonNote[]
}

async function practice(): Promise<WeeklyPracticeSummary[]> {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return (await getPracticeSummaries(d.toISOString().slice(0, 10))) ?? []
}

// ── name matching ───────────────────────────────────────────────────────────

function findStudent(q: string, students: Student[]): Student | undefined {
  const hay = q.toLowerCase()
  return students.find((s) => {
    const first = s.first_name.toLowerCase()
    const last = s.last_name.toLowerCase()
    if (first.length > 2 && (hay.includes(first) || first.includes(hay))) return true
    if (last.length > 2 && (hay.includes(last) || last.includes(hay))) return true
    return hay.includes(`${first} ${last}`)
  })
}

// ── intent handlers ─────────────────────────────────────────────────────────

async function handleStudents(students: Student[]): Promise<AssistantReply> {
  const active = students.filter((s) => s.status === 'active')
  const names = active.map((s) => `${s.first_name} ${s.last_name}${s.instrument ? ` (${s.instrument})` : ''}`)
  return {
    text: `You have ${active.length} active student${active.length === 1 ? '' : 's'}:\n\n• ${names.join('\n• ')}`,
    sources: [`students (${active.length})`],
  }
}

async function handleSchedule(events: CalendarEvent[]): Promise<AssistantReply> {
  const scheduled = events.filter((e) => e.status === 'scheduled').sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  if (scheduled.length === 0) {
    return { text: "You have no scheduled lessons this week.", sources: ['events'] }
  }
  const lines = scheduled.slice(0, 8).map((e) => {
    const who = e.student ? `${e.student.first_name} ${e.student.last_name}` : (e.title ?? (e.is_group ? e.group_name ?? 'Group' : 'Lesson'))
    return `• ${fmtDay(e.start_time)} at ${fmtTime(e.start_time)} — ${who}`
  })
  return {
    text: `This week you have ${scheduled.length} scheduled lesson${scheduled.length === 1 ? '' : 's'}:\n\n${lines.join('\n')}`,
    sources: [`events (${scheduled.length})`],
  }
}

async function handleNotes(q: string, students: Student[]): Promise<AssistantReply> {
  const notes = await lessonNotes()
  if (notes.length === 0) {
    return { text: "You don't have any lesson notes yet.", sources: ['lesson_notes'] }
  }
  const target = findStudent(q, students)
  const relevant = target ? notes.filter((n) => n.student_id === target.id) : notes
  if (relevant.length === 0) {
    return { text: `I couldn't find any notes for ${target ? target.first_name : 'that student'}.`, sources: ['lesson_notes'] }
  }
  const lines = relevant.slice(0, 5).map((n) => {
    const who = n.student ? `${n.student.first_name} ${n.student.last_name}` : 'Student'
    const text = noteText(n)
    return `• ${who} (${n.lesson_date ?? 'undated'}): ${text || '(no body)'}`
  })
  return {
    text: `Here's a summary of your recent lesson notes:\n\n${lines.join('\n')}`,
    sources: [`lesson_notes (${relevant.length})`],
  }
}

async function handleDraftMessage(q: string, students: Student[]): Promise<AssistantReply> {
  const target = findStudent(q, students)
  if (!target) {
    return {
      text: "I can draft that. Which student or family should it go to? Try: \"Draft a message to Sofia\".",
      sources: ['students'],
    }
  }
  const familyName = target.family?.name ?? `${target.last_name} family`
  const notes = await lessonNotes()
  const recent = notes.find((n) => n.student_id === target.id)
  const progress = recent ? noteText(recent).slice(0, 140) : `${target.first_name} is making steady progress and it's a joy to have them in lessons.`

  const text = `Draft message to ${familyName}:\n\nHi ${familyName.replace(/^The /, '')},\n\nQuick note from ${STUDIO} — ${target.first_name} had a wonderful lesson this week. ${progress}\n\nFor next week, a little focused practice on the assigned piece will go a long way. Please reach out if you have any questions.\n\nWarmly,\n${STUDIO}`
  return { text, sources: [`students (${target.first_name})`, 'lesson_notes'] }
}

async function handleInvoices(): Promise<AssistantReply> {
  const invs = await allInvoices()
  const open = invs.filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status))
  if (open.length === 0) {
    return { text: "You're all caught up — no outstanding invoices.", sources: ['invoices'] }
  }
  const total = open.reduce((s, i) => s + (i.balance_due ?? 0), 0)
  const lines = open.map((i) => `• ${i.family?.name ?? 'Invoice'} — ${fmtMoney(i.balance_due ?? 0)} (${i.status.replace('_', ' ')})`)
  return {
    text: `You have ${open.length} outstanding invoice${open.length === 1 ? '' : 's'} totaling ${fmtMoney(total)}:\n\n${lines.join('\n')}`,
    sources: [`invoices (${open.length})`],
  }
}

async function handlePractice(students: Student[]): Promise<AssistantReply> {
  const prac = await practice()
  if (prac.length === 0) {
    return { text: "No practice data has been logged yet this week.", sources: ['weekly_practice_summary'] }
  }
  const rows = prac
    .map((p) => {
      const s = students.find((st) => st.id === p.student_id)
      const name = s ? `${s.first_name} ${s.last_name}` : 'Student'
      return { name, ...p }
    })
    .sort((a, b) => (b.total_minutes ?? 0) - (a.total_minutes ?? 0))
  const lines = rows.map((r) => `• ${r.name} — ${r.total_minutes ?? 0} min over ${r.days_practiced ?? 0} days${r.goal_met ? ' ✓ goal met' : ''}`)
  return {
    text: `This week's practice leaderboard:\n\n${lines.join('\n')}`,
    sources: [`weekly_practice_summary (${prac.length})`],
  }
}

async function handleLibrary(q: string): Promise<AssistantReply> {
  const lib = await library()
  if (lib.length === 0) {
    return { text: "Your resource library is empty.", sources: ['resources'] }
  }
  const terms = q.replace(/search|library|find|for|my|resources|files|about/g, '').trim().split(/\s+/).filter(Boolean)
  const matches = terms.length
    ? lib.filter((r) => terms.some((t) => `${r.title} ${r.description ?? ''}`.toLowerCase().includes(t)))
    : lib
  if (matches.length === 0) {
    return { text: `No resources matched your search. You have ${lib.length} resource(s) total — try a different keyword.`, sources: ['resources'] }
  }
  const lines = matches.slice(0, 8).map((r) => `• ${r.title}${r.description ? ` — ${r.description}` : ''}`)
  return {
    text: `Found ${matches.length} resource${matches.length === 1 ? '' : 's'}:\n\n${lines.join('\n')}`,
    sources: [`resources (${matches.length})`],
  }
}

const HELP = `I'm your local Cadenza assistant. I can look across your own studio data — nothing leaves your computer. Try asking:\n\n• "How many students do I have?"\n• "What's on my schedule this week?"\n• "Summarize my lesson notes"\n• "Draft a message to <student>"\n• "Any outstanding invoices?"\n• "Practice leaderboard"\n• "Search my library for <keyword>"`

// ─── main entry ─────────────────────────────────────────────────────────────

export async function runAssistant(rawQuery: string): Promise<AssistantReply> {
  const q = rawQuery.toLowerCase().trim()

  // Greeting / help
  if (/^(hi|hello|hey|help|what can you do|capabilities|\?)/.test(q)) {
    return { text: HELP, sources: ['assistant'] }
  }

  const students = await roster()

  // Draft / write a message or email
  if (/\b(draft|write|compose)\b/.test(q) && /\b(message|email|text|note to|email to)\b/.test(q)) {
    return handleDraftMessage(q, students)
  }

  // Summarize notes
  if (/\b(summar|summary|summarize)\b/.test(q) || (/\bnotes\b/.test(q) && /\b(summar|recent|lesson)\b/.test(q))) {
    return handleNotes(q, students)
  }

  // Schedule / calendar
  if (/\b(schedule|calendar|this week|upcoming|lessons? (today|this)|what's on|whats on)\b/.test(q)) {
    return handleSchedule(await thisWeekEvents())
  }

  // Invoices / billing
  if (/\b(invoice|invoices|billing|overdue|outstanding|payments?)\b/.test(q)) {
    return handleInvoices()
  }

  // Practice
  if (/\b(practice|leaderboard|streak|minutes|progress)\b/.test(q)) {
    return handlePractice(students)
  }

  // Library / resources
  if (/\b(resource|resources|library|file|files|find|search)\b/.test(q)) {
    return handleLibrary(q)
  }

  // Students / roster
  if (/\b(student|students|roster|who|how many)\b/.test(q)) {
    return handleStudents(students)
  }

  // Fallback
  return {
    text: `I'm not sure how to do that yet, but I can help with your students, schedule, notes, invoices, practice, and library. ${HELP.split('\n\n')[0]}`,
    sources: ['assistant'],
  }
}
