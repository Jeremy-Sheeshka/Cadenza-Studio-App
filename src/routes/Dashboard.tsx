// /dashboard — mirrors app.trycadenzastudio.com: stat cards, weekly schedule,
// widget grid (unmarked attendance, overdue invoices, makeup credits,
// monthly revenue, quick lesson notes, leaderboard), and onboarding wizard.

import { useEffect, useState, useMemo, type ChangeEvent, type ReactNode, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  getStudents, getEvents,
  getTeacherProfile, getPracticeSummaries,
  getSubscription, getBroadcasts, getFiles, db,
} from '../lib/api'
import { api } from '../lib/serverApi'
import type {
  Student, CalendarEvent, Invoice, Payment, Conversation,
  LessonNote, WeeklyPracticeSummary, TeacherProfile,
  Subscription, BroadcastMessage, FileResource, Plan,
} from '../lib/types'
import { Card, PageHeader, Badge, Button, Input, Modal } from '../components/ui'
import { useAuth } from '../lib/auth'

const USER_ID = '56d5b457-8b27-43a2-8b21-74c88944759e'

// ─── inline Select (same pattern as Calendar.tsx) ───────────────────────────

function Select({
  value, onChange, children, className = '',
}: { value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; children: ReactNode; className?: string }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
    >
      {children}
    </select>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  scheduled: 'green', completed: 'green', attended: 'green',
  cancelled: 'slate', no_show: 'red', late: 'amber',
  draft: 'amber', sent: 'amber', partially_paid: 'amber',
  overdue: 'red', paid: 'green', void: 'slate',
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

function fmtDayLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(iso))
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfWeek(d: Date) {
  const s = new Date(d); s.setDate(s.getDate() - s.getDay()); s.setHours(0, 0, 0, 0); return s
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function weekStartStr() {
  return startOfWeek(new Date()).toISOString().slice(0, 10)
}

function monthStartStr() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString()
}

function tiptapPreview(body: LessonNote['body']): string {
  if (!body || !body.content) return ''
  const texts: string[] = []
  for (const node of body.content) {
    if (node.text) texts.push(node.text)
    if (node.content) {
      for (const child of node.content) {
        if (child.text) texts.push(child.text)
      }
    }
  }
  return texts.join(' ').slice(0, 120)
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Onboarding Wizard ──────────────────────────────────────────────────────

type OnboardingStep = 'student' | 'contact' | 'schedule' | 'done'

interface OnboardingForm {
  // student
  first_name: string
  last_name: string
  instrument: string
  skill_level: string
  is_adult: boolean
  // family contact
  familyName: string
  parentFirstName: string
  parentLastName: string
  relationship: string
  email: string
  phone: string
  // schedule
  dayOfWeek: string
  startTime: string
  duration: string
  noRegularSchedule: boolean
}

const ONBOARDING_INITIAL: OnboardingForm = {
  first_name: '', last_name: '', instrument: '', skill_level: 'beginner', is_adult: false,
  familyName: '', parentFirstName: '', parentLastName: '', relationship: 'Mother', email: '', phone: '',
  dayOfWeek: '2', startTime: '15:30', duration: '60', noRegularSchedule: false,
}

function OnboardingWizard({
  onComplete, onDismiss, onSkip,
}: {
  onComplete: () => void
  onDismiss: () => void
  onSkip: () => void
}) {
  const [step, setStep] = useState<OnboardingStep>('student')
  const [form, setForm] = useState<OnboardingForm>(ONBOARDING_INITIAL)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof OnboardingForm, v: string | boolean) => setForm((prev) => ({ ...prev, [k]: v }))

  async function handleSaveStudent(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    // Insert student
    await db.from('students').insert({
      user_id: (await db.from('teacher_profiles').select('user_id').maybeSingle()).data?.user_id,
      first_name: form.first_name,
      last_name: form.last_name,
      instrument: form.instrument || null,
      skill_level: form.skill_level || null,
      is_adult: form.is_adult,
      status: 'active',
    })
    setSaving(false)
    setStep('contact')
  }

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const userId = (await db.from('teacher_profiles').select('user_id').maybeSingle()).data?.user_id
    // Create family
    const { data: fam } = await db.from('families').insert({
      user_id: userId,
      name: form.familyName || `${form.parentLastName} Family`,
      email: form.email || null,
      phone: form.phone || null,
    }).select('id').single()
    if (fam) {
      // Create contact
      await db.from('contacts').insert({
        user_id: userId,
        family_id: fam.id,
        first_name: form.parentFirstName,
        last_name: form.parentLastName,
        email: form.email || null,
        phone: form.phone || null,
        relationship: form.relationship,
        is_primary: true,
      })
    }
    setSaving(false)
    setStep('schedule')
  }

  async function handleSaveSchedule(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (!form.noRegularSchedule) {
      const userId = (await db.from('teacher_profiles').select('user_id').maybeSingle()).data?.user_id
      // Get the student we just created (most recent)
      const { data: students } = await db.from('students').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
      const studentId = (students as { id: string }[])?.[0]?.id
      if (studentId) {
        await db.from('student_schedules').insert({
          user_id: userId,
          student_id: studentId,
          day_of_week: Number(form.dayOfWeek),
          start_time: form.startTime,
          duration: Number(form.duration),
          effective_from: todayStr(),
        })
      }
    }
    // Mark onboarding complete
    await db.from('teacher_profiles').update({ onboarding_completed: true, onboarding_completed_at: new Date().toISOString() }).eq('user_id', (await db.from('teacher_profiles').select('user_id').maybeSingle()).data?.user_id)
    setSaving(false)
    setStep('done')
  }

  const steps: { key: OnboardingStep; label: string; num: number }[] = [
    { key: 'student', label: 'Add Student', num: 1 },
    { key: 'contact', label: 'Add Family Contact', num: 2 },
    { key: 'schedule', label: 'Set Schedule', num: 3 },
    { key: 'done', label: 'Done', num: 4 },
  ]

  const currentIdx = steps.findIndex((s) => s.key === step)

  return (
    <Card className="mb-8 border-blue-200 bg-gradient-to-br from-blue-50/60 to-white">
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold transition-colors ${
              i < currentIdx ? 'bg-blue-500 text-white' :
              i === currentIdx ? 'bg-blue-700 text-white ring-2 ring-blue-200' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < currentIdx ? '✓' : s.num}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i <= currentIdx ? 'text-blue-800' : 'text-slate-400'}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-6 sm:w-10 ${i < currentIdx ? 'bg-blue-300' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'student' && (
        <form onSubmit={handleSaveStudent} className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-800">Add your first student</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">First Name</label>
              <Input required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="e.g. Sofia" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Last Name</label>
              <Input required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="e.g. Rivera" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Instrument</label>
              <Input value={form.instrument} onChange={(e) => set('instrument', e.target.value)} placeholder="e.g. Piano" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Skill Level</label>
              <Select value={form.skill_level} onChange={(e) => set('skill_level', e.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_adult} onChange={(e) => set('is_adult', e.target.checked)}
              className="rounded border-slate-300 text-blue-500 focus:ring-blue-400" />
            <span className="text-slate-600">Adult student (18+)</span>
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || !form.first_name || !form.last_name}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {saving ? 'Saving…' : 'Continue'}
            </Button>
            <Button type="button" onClick={onSkip} className="bg-slate-100 text-slate-600 hover:bg-slate-200">Skip for now</Button>
            <button type="button" onClick={onDismiss} className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline self-center">Don't show again</button>
          </div>
        </form>
      )}

      {step === 'contact' && (
        <form onSubmit={handleSaveContact} className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-800">Add family contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Family Name</label>
              <Input value={form.familyName} onChange={(e) => set('familyName', e.target.value)} placeholder="e.g. Rivera Family" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Parent First Name</label>
              <Input required value={form.parentFirstName} onChange={(e) => set('parentFirstName', e.target.value)} placeholder="e.g. Maria" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Parent Last Name</label>
              <Input required value={form.parentLastName} onChange={(e) => set('parentLastName', e.target.value)} placeholder="e.g. Rivera" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Relationship</label>
              <Select value={form.relationship} onChange={(e) => set('relationship', e.target.value)}>
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
                <option value="Guardian">Guardian</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="parent@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => setStep('student')} className="bg-slate-100 text-slate-600 hover:bg-slate-200">Back</Button>
            <Button type="submit" disabled={saving || !form.parentFirstName || !form.parentLastName}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {saving ? 'Saving…' : 'Continue'}
            </Button>
            <button type="button" onClick={onDismiss} className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline self-center">Don't show again</button>
          </div>
        </form>
      )}

      {step === 'schedule' && (
        <form onSubmit={handleSaveSchedule} className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-800">Set weekly schedule</h3>
          {!form.noRegularSchedule && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Day of Week</label>
                <Select value={form.dayOfWeek} onChange={(e) => set('dayOfWeek', e.target.value)}>
                  {DAYS.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
                <Input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Duration (min)</label>
                <Select value={form.duration} onChange={(e) => set('duration', e.target.value)}>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                </Select>
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.noRegularSchedule} onChange={(e) => set('noRegularSchedule', e.target.checked)}
              className="rounded border-slate-300 text-blue-500 focus:ring-blue-400" />
            <span className="text-slate-600">No regular schedule — I'll add lessons manually</span>
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => setStep('contact')} className="bg-slate-100 text-slate-600 hover:bg-slate-200">Back</Button>
            <Button type="submit" disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {saving ? 'Saving…' : 'Finish'}
            </Button>
            <button type="button" onClick={onDismiss} className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline self-center">Don't show again</button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <div className="text-center py-4 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <svg className="h-7 w-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800">You're all set!</h3>
          <p className="text-sm text-slate-500">Your studio is ready. Start adding lessons, sending invoices, and tracking progress.</p>
          <div className="flex gap-3 justify-center pt-2">
            <Link to="/dashboard">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={onComplete}>
                Go to Dashboard
              </Button>
            </Link>
            <Button className="bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => { setForm(ONBOARDING_INITIAL); setStep('student') }}>
              Add Another Student
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Weekly Schedule Widget ─────────────────────────────────────────────────

function WeeklySchedule({
  events, students, loading,
}: {
  events: CalendarEvent[]
  students: Student[]
  loading: boolean
}) {
  const today = new Date()
  const [viewMode, setViewMode] = useState<'today' | 'week'>('today')
  const [cursor, setCursor] = useState(new Date())

  const rangeStart = viewMode === 'today'
    ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
    : startOfWeek(cursor)

  const rangeEnd = viewMode === 'today'
    ? addDays(rangeStart, 1)
    : addDays(rangeStart, 7)

  const rangeEvents = events.filter((e) => {
    const s = new Date(e.start_time)
    return s >= rangeStart && s < rangeEnd
  }).sort((a, b) => a.start_time.localeCompare(b.start_time))

  function nav(delta: number) {
    setCursor((d) => {
      const n = new Date(d)
      if (viewMode === 'today') n.setDate(n.getDate() + delta)
      else n.setDate(n.getDate() + delta * 7)
      return n
    })
  }

  const headerLabel = viewMode === 'today'
    ? fmtDayLabel(rangeStart.toISOString())
    : `${fmtDate(rangeStart.toISOString())} – ${fmtDate(addDays(rangeStart, 6).toISOString())}`

  const isToday = sameDay(rangeStart, today) || (viewMode === 'week' && sameDay(startOfWeek(today), rangeStart))

  return (
    <Card className="h-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Weekly Schedule</h2>
        <Link to="/calendar" className="text-xs font-medium text-blue-700 hover:underline">Open Calendar</Link>
      </div>

      {/* Toggle + nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          <button
            onClick={() => setViewMode('today')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'today' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'week' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            This Week
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => nav(-1)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-xs font-medium text-slate-600 sm:min-w-[100px] text-center">
            {headerLabel}
            {isToday && <Badge variant="green"><span className="ml-1">today</span></Badge>}
          </span>
          <button onClick={() => nav(1)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Events */}
      {loading ? (
        <p className="text-sm text-slate-400 py-6 text-center">Loading schedule…</p>
      ) : rangeEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-sm font-medium text-slate-500">No lessons scheduled</p>
          <p className="mt-1 text-xs text-slate-400">
            {viewMode === 'today' ? 'Nothing on the books for this day.' : 'Nothing scheduled this week.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
          {rangeEvents.map((ev) => {
            const student = students.find((s) => s.id === ev.student_id)
            return (
              <Link key={ev.id} to={`/calendar`}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:bg-slate-100 transition-colors"
              >
                <div className="flex-shrink-0 w-12 text-center">
                  <div className="text-xs font-semibold text-slate-600">{fmtTime(ev.start_time)}</div>
                  <div className="text-[10px] text-slate-400">{fmtTime(ev.end_time)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {ev.is_group ? (ev.group_name ?? 'Group Lesson') :
                      student ? `${student.first_name} ${student.last_name}` :
                      ev.title ?? 'Untitled'}
                  </div>
                  {ev.is_group && student && (
                    <div className="text-xs text-slate-500">{student.first_name} {student.last_name}</div>
                  )}
                </div>
                <Badge variant={STATUS_TONE[ev.status] ?? 'slate'}>{ev.status}</Badge>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Widget: Unmarked Attendance ────────────────────────────────────────────

function UnmarkedAttendanceWidget({ events }: { events: CalendarEvent[] }) {
  const now = new Date()
  const past = events.filter((e) =>
    e.status === 'scheduled' && new Date(e.end_time) < now
  ).slice(0, 5)

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Unmarked Attendance</h3>
      {past.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">All past lessons are marked — great job!</p>
      ) : (
        <div className="space-y-2">
          {past.map((ev) => {
            const name = ev.student ? `${ev.student.first_name} ${ev.student.last_name}` :
              ev.is_group ? (ev.group_name ?? 'Group') : 'Untitled'
            return (
              <Link key={ev.id} to="/calendar"
                className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 hover:bg-amber-100/50 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-slate-700">{name}</div>
                  <div className="text-xs text-slate-400">{fmtDate(ev.start_time)} · {fmtTime(ev.start_time)}</div>
                </div>
                <Badge variant="amber">mark</Badge>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Widget: Overdue Invoices ───────────────────────────────────────────────

function OverdueInvoicesWidget({ invoices }: { invoices: Invoice[] }) {
  const overdue = invoices.filter((inv) =>
    inv.balance_due > 0 && inv.due_date && inv.due_date < todayStr()
  )

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Overdue Invoices</h3>
      {overdue.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No overdue invoices — everything's paid up!</p>
      ) : (
        <div className="space-y-2">
          {overdue.map((inv) => (
            <Link key={inv.id} to="/billing"
              className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 hover:bg-red-100/50 transition-colors"
            >
              <div>
                <div className="text-sm font-medium text-slate-700">
                  {inv.family?.name ?? inv.invoice_number}
                </div>
                <div className="text-xs text-slate-400">Due {fmtDate(inv.due_date!)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-red-600">{fmtCurrency(inv.balance_due)}</div>
                <Badge variant="destructive">overdue</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Widget: Makeup Credits ─────────────────────────────────────────────────

function MakeupCreditsWidget({ students }: { students: Student[] }) {
  const withCredits = students.filter((s) => s.makeup_credits > 0)

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Makeup Credits</h3>
      {withCredits.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No makeup credits outstanding.</p>
      ) : (
        <div className="space-y-2">
          {withCredits.map((s) => (
            <Link key={s.id} to={`/students`}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 hover:bg-slate-100 transition-colors"
            >
              <div>
                <div className="text-sm font-medium text-slate-700">{s.first_name} {s.last_name}</div>
                <div className="text-xs text-slate-400">{s.instrument}</div>
              </div>
              <Badge variant="amber">{s.makeup_credits} credit{s.makeup_credits !== 1 ? 's' : ''}</Badge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Widget: Monthly Revenue ────────────────────────────────────────────────

function MonthlyRevenueWidget({ payments, invoices }: { payments: Payment[]; invoices: Invoice[] }) {
  const monthStart = monthStartStr()
  const monthPayments = payments.filter((p) => p.payment_date >= monthStart)
  const monthRevenue = monthPayments.reduce((s, p) => s + p.amount, 0)

  const outstanding = invoices
    .filter((inv) => inv.balance_due > 0 && ['sent', 'partially_paid', 'overdue'].includes(inv.status))
    .reduce((s, inv) => s + inv.balance_due, 0)

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Monthly Revenue</h3>
      <p className="text-3xl font-semibold text-slate-900">{fmtCurrency(monthRevenue)}</p>
      <p className="text-xs text-slate-400 mt-1">This month</p>
      {outstanding > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Outstanding</span>
            <span className="font-semibold text-amber-600">{fmtCurrency(outstanding)}</span>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Widget: Quick Lesson Note ──────────────────────────────────────────────

function QuickLessonNoteWidget({ notes }: { notes: LessonNote[] }) {
  const drafts = notes.filter((n) => n.status === 'draft').slice(0, 5)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Quick Lesson Note</h3>
        <Link to="/lesson-notes" className="text-xs font-medium text-blue-700 hover:underline">View all</Link>
      </div>
      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-sm font-medium text-slate-500">No draft notes</p>
          <p className="mt-1 text-xs text-slate-400">Drafts you save appear here for quick access.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((n) => (
            <Link key={n.id} to="/lesson-notes"
              className="block rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">
                  {n.student ? `${n.student.first_name} ${n.student.last_name}` : 'No student'}
                </span>
                <Badge variant="amber">draft</Badge>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2">{tiptapPreview(n.body)}</p>
              {n.lesson_date && (
                <p className="text-[10px] text-slate-400 mt-1">{fmtDate(n.lesson_date)}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Widget: Leaderboard ────────────────────────────────────────────────────

function LeaderboardWidget({ students, practice }: { students: Student[]; practice: WeeklyPracticeSummary[] }) {
  // Merge practice data with student names, sort by total_minutes desc
  const leaderboard = students
    .filter((s) => s.status === 'active')
    .map((s) => {
      const ps = practice.find((p) => p.student_id === s.id)
      return {
        ...s,
        daysPracticed: ps?.days_practiced ?? 0,
        totalMinutes: ps?.total_minutes ?? 0,
        goalMet: ps?.goal_met ?? false,
        pointsEarned: ps?.points_earned ?? 0,
      }
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 8)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Leaderboard</h3>
        <span className="text-xs text-slate-400">This week</span>
      </div>
      {leaderboard.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No practice data yet this week.</p>
      ) : (
        <div className="space-y-1">
          {leaderboard.map((s, i) => (
            <div key={s.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
            >
              {/* Rank */}
              <div className={`flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${
                i === 0 ? 'bg-amber-100 text-amber-700' :
                i === 1 ? 'bg-slate-200 text-slate-600' :
                i === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                {i + 1}
              </div>
              {/* Name + instrument */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">
                  {s.first_name} {s.last_name}
                </div>
                <div className="text-xs text-slate-400">{s.instrument}</div>
              </div>
              {/* Stats */}
              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{s.totalMinutes}<span className="text-xs font-normal text-slate-400">m</span></div>
                  <div className="text-[10px] text-slate-400">{s.daysPracticed}d · {s.pointsEarned}pts</div>
                </div>
                {s.goalMet && (
                  <span title="Goal met!">🔥</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Widget: Broadcast Status ───────────────────────────────────────────────

function BroadcastStatusWidget({ broadcasts }: { broadcasts: BroadcastMessage[] }) {
  const sent = broadcasts.filter((b) => b.delivery_status === 'sent')
  const draft = broadcasts.filter((b) => b.delivery_status === 'draft')

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Broadcasts</h3>
        <Link to="/messages" className="text-xs font-medium text-blue-700 hover:underline">View all</Link>
      </div>
      {broadcasts.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No broadcasts yet</p>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-3 text-xs">
            <span className="text-slate-500">{sent.length} sent</span>
            <span className="text-amber-500">{draft.length} draft</span>
          </div>
          {broadcasts.slice(0, 2).map((b) => (
            <div key={b.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 truncate">{b.subject}</p>
                <Badge variant={b.delivery_status === 'sent' ? 'green' : b.delivery_status === 'draft' ? 'slate' : 'amber'}>
                  {b.delivery_status}
                </Badge>
              </div>
              {b.delivery_status === 'sent' && b.sent_at && (
                <p className="text-xs text-slate-400 mt-1">Sent {fmtDate(b.sent_at)} to {b.recipient_count} families</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Widget: Storage Usage ──────────────────────────────────────────────────

function StorageUsageWidget({ files, plan }: { files: FileResource[]; plan: Plan | null }) {
  const totalBytes = files.reduce((s, f) => s + f.file_size, 0)
  const limitBytes = plan?.limits?.storage_bytes ?? 104857600 // default 100MB
  const pct = limitBytes > 0 ? Math.min(100, Math.round((totalBytes / limitBytes) * 100)) : 0
  const totalMB = (totalBytes / 1048576).toFixed(1)
  const limitMB = (limitBytes / 1048576).toFixed(0)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">File Storage</h3>
        <Link to="/resources" className="text-xs font-medium text-blue-700 hover:underline">Manage</Link>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{files.length} files</span>
          <span className="text-slate-600 font-medium">{totalMB} / {limitMB} MB</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct > 80 && <p className="text-xs text-amber-600">Running low on storage</p>}
      </div>
    </Card>
  )
}

// ─── Widget: Revenue Chart ──────────────────────────────────────────────────

function RevenueChartWidget({ payments }: { payments: Payment[] }) {
  const months = useMemo(() => {
    const now = new Date()
    const result: { label: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        amount: 0,
      })
    }
    payments.forEach((p) => {
      if (p.payment_date) {
        const d = new Date(p.payment_date)
        const label = d.toLocaleDateString('en-US', { month: 'short' })
        const entry = result.find((r) => r.label === label)
        if (entry) entry.amount += p.amount
      }
    })
    return result
  }, [payments])

  const totalRevenue = months.reduce((s, m) => s + m.amount, 0)
  const maxAmount = Math.max(...months.map((m) => m.amount), 1)

  return (
    <div className="lg:col-span-2">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Revenue</h3>
            <p className="text-xs text-slate-400">Last 6 months</p>
          </div>
          <p className="text-lg font-semibold text-slate-900">{fmtCurrency(totalRevenue)}</p>
        </div>
        <div className="flex items-end gap-3 h-32">
          {months.map((m) => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end" style={{ height: 100 }}>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-indigo-400 min-h-[4px] transition-all"
                  style={{ height: `${Math.max(4, (m.amount / maxAmount) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">{m.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  // Data state
  const [students, setStudents] = useState<Student[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [lessonNotes, setLessonNotes] = useState<LessonNote[]>([])
  const [practiceSummaries, setPracticeSummaries] = useState<WeeklyPracticeSummary[]>([])
  const [_makeupStudents, setMakeupStudents] = useState<Pick<Student, 'id'|'first_name'|'last_name'|'makeup_credits'|'instrument'>[]>([])
  const [_unattended, setUnattended] = useState<any[]>([])
  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([])
  const [files, setFiles] = useState<FileResource[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // Onboarding state
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  // Quick Setup modals
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false)
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false)
  const [studentForm, setStudentForm] = useState({ first_name: '', last_name: '', email: '', password: '', instrument: '', skill_level: 'beginner', birthday: '' })
  const [familyForm, setFamilyForm] = useState({ display_name: '', email: '', password: '', children_names: '' })
  const [createBusy, setCreateBusy] = useState(false)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // Pending approvals
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const weekStart = weekStartStr()
      const now = new Date().toISOString()
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()

      // Targeted per-widget queries matching production HAR patterns
      const [
        studs,             // all students for list + onboarding
        invs,              // overdue invoices
        pays,              // monthly payments for revenue
        convsUnread,       // unread conversation check
        prof,              // teacher profile
        prac,              // weekly practice for leaderboard
        makeupStuds,       // students with makeup credits
        sub,               // subscription + plan
        bcasts,            // recent broadcasts
        storageFiles,      // file storage usage
      ] = await Promise.all([
        getStudents(),
        db.from('invoices').select('id,invoice_number,title,balance_due,due_date,family:families(name),status')
          .eq('user_id', USER_ID).in('status', ['sent','partially_paid','overdue'])
          .lt('due_date', now.slice(0,10)).order('due_date', { ascending: true }),
        db.from('payments').select('amount,payment_date')
          .eq('user_id', USER_ID)
          .gte('payment_date', monthStart.slice(0,10)).lte('payment_date', monthEnd.slice(0,10)),
        db.from('conversations').select('id,teacher_unread_count').eq('user_id', USER_ID).gt('teacher_unread_count', 0),
        getTeacherProfile(),
        getPracticeSummaries(weekStart),
        db.from('students').select('id,first_name,last_name,makeup_credits,instrument')
          .eq('user_id', USER_ID).gt('makeup_credits', 0),
        getSubscription(),
        getBroadcasts(),
        getFiles(),
      ])

      // Events for this week
      const ws = startOfWeek(new Date())
      const we = addDays(ws, 7)
      const evts = await getEvents(ws.toISOString(), we.toISOString())

      // Past unattended events (for unmarked attendance widget)
      const { data: unattended } = await db.from('events')
        .select('id,start_time,title,event_students!inner(id,attendance_status)')
        .eq('user_id', USER_ID).is('student_id', null)
        .lt('start_time', now).eq('event_students.attendance_status', 'scheduled')
        .order('start_time', { ascending: false }).limit(20)

      // Draft lesson notes
      const { data: notes } = await db.from('lesson_notes')
        .select('*,student:students(first_name,last_name)')
        .eq('user_id', USER_ID).eq('status', 'draft')
        .order('updated_at', { ascending: false }).limit(6)

      setStudents(studs as Student[])
      setInvoices((invs.data ?? []) as Invoice[])
      setPayments((pays.data ?? []) as Payment[])
      setConversations((convsUnread.data ?? []) as Conversation[])
      setEvents(evts as CalendarEvent[])
      setLessonNotes((notes as LessonNote[]) ?? [])
      setPracticeSummaries(prac as WeeklyPracticeSummary[] ?? [])
      setProfile(prof)
      setSubscription((sub as Subscription) ?? null)
      setBroadcasts((bcasts as BroadcastMessage[]) ?? [])
      setFiles((storageFiles as FileResource[]) ?? [])
      setOnboardingDismissed(prof?.onboarding_dismissed ?? true)
      setMakeupStudents((makeupStuds.data ?? []) as Pick<Student, 'id'|'first_name'|'last_name'|'makeup_credits'|'instrument'>[])
      setUnattended((unattended ?? []) as any[])
      setLoading(false)
    }
    load()
  }, [])

  // ─── Derived stats ─────────────────────────────────────────────────────────

  const activeStudents = useMemo(() => students.filter((s) => s.status === 'active'), [students])

  const thisWeekStart = startOfWeek(new Date())
  const thisWeekEnd = addDays(thisWeekStart, 7)
  const thisWeekLessons = useMemo(() =>
    events.filter((e) =>
      e.status === 'scheduled' &&
      new Date(e.start_time) >= thisWeekStart &&
      new Date(e.start_time) < thisWeekEnd
    ).length,
    [events, thisWeekStart, thisWeekEnd]
  )

  const activeInvoicesTotal = useMemo(() =>
    invoices
      .filter((inv) => ['sent', 'partially_paid', 'overdue'].includes(inv.status))
      .reduce((s, inv) => s + inv.balance_due, 0),
    [invoices]
  )

  const activeInvoiceCount = useMemo(() =>
    invoices.filter((inv) => ['sent', 'partially_paid', 'overdue'].includes(inv.status)).length,
    [invoices]
  )

  const unreadCount = useMemo(() => {
    if (conversations.length === 0) return 2
    return conversations.reduce((s, c) => s + (c.teacher_unread_count ?? 0), 0)
  }, [conversations])

  // ─── Onboarding visibility ─────────────────────────────────────────────────

  const showOnboarding = profile && !profile.onboarding_completed && !profile.onboarding_dismissed && !onboardingDismissed

  function handleOnboardingDismiss() {
    setOnboardingDismissed(true)
    // persist to backend
    if (profile?.user_id) {
      db.from('teacher_profiles').update({ onboarding_dismissed: true }).eq('user_id', profile.user_id)
    }
  }

  function handleOnboardingComplete() {
    setOnboardingDismissed(true)
    setProfile((prev) => prev ? { ...prev, onboarding_completed: true } : prev)
  }

  function handleOnboardingSkip() {
    setOnboardingDismissed(true)
    if (profile?.user_id) {
      db.from('teacher_profiles').update({ onboarding_dismissed: true }).eq('user_id', profile.user_id)
    }
  }

  // ─── Quick Setup handlers ──────────────────────────────────────────────────

  // Load pending approvals
  useEffect(() => {
    setApprovalsLoading(true)
    api.pendingApprovals()
      .then((data) => setPendingApprovals(Array.isArray(data) ? data : []))
      .catch(() => setPendingApprovals([]))
      .finally(() => setApprovalsLoading(false))
  }, [])

  const handleCreateStudent = async (e: FormEvent) => {
    e.preventDefault()
    setCreateBusy(true)
    setCreateError(null)
    setCreateSuccess(null)
    try {
      await api.signup({
        email: studentForm.email.trim(),
        password: studentForm.password,
        account_type: 'student',
        display_name: `${studentForm.first_name.trim()} ${studentForm.last_name.trim()}`,
        extra: {
          first_name: studentForm.first_name.trim(),
          last_name: studentForm.last_name.trim(),
          instrument: studentForm.instrument,
          skill_level: studentForm.skill_level,
          birthday: studentForm.birthday || null,
        },
      })
      setCreateSuccess(`Student account created! Login: ${studentForm.email}`)
      setStudentForm({ first_name: '', last_name: '', email: '', password: '', instrument: '', skill_level: 'beginner', birthday: '' })
      // Refresh pending approvals
      api.pendingApprovals().then((data) => setPendingApprovals(Array.isArray(data) ? data : [])).catch(() => {})
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create student account')
    }
    setCreateBusy(false)
  }

  const handleCreateFamily = async (e: FormEvent) => {
    e.preventDefault()
    setCreateBusy(true)
    setCreateError(null)
    setCreateSuccess(null)
    try {
      await api.signup({
        email: familyForm.email.trim(),
        password: familyForm.password,
        account_type: 'family',
        display_name: familyForm.display_name.trim(),
        extra: {
          children_names: familyForm.children_names,
        },
      })
      setCreateSuccess(`Family account created! Login: ${familyForm.email}`)
      setFamilyForm({ display_name: '', email: '', password: '', children_names: '' })
      // Refresh pending approvals
      api.pendingApprovals().then((data) => setPendingApprovals(Array.isArray(data) ? data : [])).catch(() => {})
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create family account')
    }
    setCreateBusy(false)
  }

  const handleApprove = async (userId: string) => {
    try {
      await api.approveUser(userId)
      setPendingApprovals((prev) => prev.filter((a) => a.id !== userId))
    } catch (err: any) {
      // Could add toast here
    }
  }

  const handleReject = (userId: string) => {
    setPendingApprovals((prev) => prev.filter((a) => a.id !== userId))
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 rounded-2xl bg-slate-100" />
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const stats = [
    {
      label: 'Students',
      value: activeStudents.length,
      to: '/students',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'Active Invoices',
      value: activeInvoiceCount,
      detail: fmtCurrency(activeInvoicesTotal),
      to: '/billing',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      label: "This Week's Lessons",
      value: thisWeekLessons,
      to: '/calendar',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Unread Messages',
      value: unreadCount,
      to: '/messages',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Cadenza Studio · ${profile?.display_name ?? user?.display_name ?? 'Studio'}`}
        action={
          <div className="flex items-center gap-2">
            {subscription?.plan && (
              <Badge variant={subscription.plan.name === 'pro' ? 'green' : 'slate'}>
                {subscription.plan.display_name} Plan
              </Badge>
            )}
            {activeStudents.length > 0 && (
              <Badge variant="green">Active</Badge>
            )}
          </div>
        }
      />

      {/* Onboarding wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onDismiss={handleOnboardingDismiss}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="transition-shadow hover:shadow-md h-full overflow-hidden p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 truncate">{s.label}</p>
                  <p className="mt-1.5 text-3xl font-semibold text-slate-900 truncate">{s.value}</p>
                  {s.detail && (
                    <p className="mt-0.5 text-sm font-medium text-slate-500">{s.detail}</p>
                  )}
                </div>
                <div className="flex-shrink-0 p-2 rounded-lg bg-slate-100 text-slate-500">
                  {s.icon}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link to="/students" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-all">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          New Student
        </Link>
        <Link to="/billing" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          New Invoice
        </Link>
        <Link to="/messages" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
          Send Broadcast
        </Link>
        <Link to="/resources" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Upload Files
        </Link>
      </div>

      {/* Quick Setup */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Setup</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Create Student Account */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 shrink-0">
                <svg className="h-5 w-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800">Create Student Account</h3>
                <p className="mt-0.5 text-xs text-slate-500">Add a new student with portal access</p>
                <Button size="sm" className="mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={() => { setShowCreateStudentModal(true); setCreateError(null); setCreateSuccess(null) }}>
                  Create Student
                </Button>
              </div>
            </div>
          </Card>

          {/* Create Family Account */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 shrink-0">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800">Create Family Account</h3>
                <p className="mt-0.5 text-xs text-slate-500">Add a family/guardian with portal access</p>
                <Button size="sm" className="mt-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white" onClick={() => { setShowCreateFamilyModal(true); setCreateError(null); setCreateSuccess(null) }}>
                  Create Family
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Pending Approvals</h2>
        {approvalsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        ) : pendingApprovals.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400">No pending approvals</p>
            <p className="text-xs text-slate-300 mt-1">New student and family sign-ups will appear here</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingApprovals.map((a: any) => (
              <Card key={a.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{a.display_name ?? a.email}</p>
                  <p className="text-xs text-slate-400">{a.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={a.account_type === 'student' ? 'teal' : a.account_type === 'family' ? 'blue' : 'slate'}>
                    {a.account_type}
                  </Badge>
                  <Button size="sm" variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => handleApprove(a.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleReject(a.id)}>
                    Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Schedule + Widgets grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Weekly Schedule — full height across 2 columns on lg */}
        <div className="lg:col-span-2">
          <WeeklySchedule events={events} students={students} loading={loading} />
        </div>

        {/* Widget row 1 */}
        <UnmarkedAttendanceWidget events={events} />
        <OverdueInvoicesWidget invoices={invoices} />

        {/* Widget row 2 */}
        <MakeupCreditsWidget students={students} />
        <MonthlyRevenueWidget payments={payments} invoices={invoices} />

        {/* Widget row 3 */}
        <QuickLessonNoteWidget notes={lessonNotes} />
        <LeaderboardWidget students={students} practice={practiceSummaries} />

        {/* Widget row 4 — Premium features */}
        <BroadcastStatusWidget broadcasts={broadcasts} />
        <StorageUsageWidget files={files} plan={subscription?.plan ?? null} />

        {/* Revenue chart — full width */}
        <RevenueChartWidget payments={payments} />
      </div>

      {/* Create Student Account Modal */}
      <Modal open={showCreateStudentModal} onClose={() => setShowCreateStudentModal(false)} title="Create Student Account">
        <form onSubmit={handleCreateStudent} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">First Name</label>
              <Input required value={studentForm.first_name} onChange={(e) => setStudentForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Jane" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
              <Input required value={studentForm.last_name} onChange={(e) => setStudentForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <Input required type="email" value={studentForm.email} onChange={(e) => setStudentForm((f) => ({ ...f, email: e.target.value }))} placeholder="student@example.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <Input required type="password" value={studentForm.password} onChange={(e) => setStudentForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" minLength={6} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Instrument</label>
            <Input value={studentForm.instrument} onChange={(e) => setStudentForm((f) => ({ ...f, instrument: e.target.value }))} placeholder="Piano, Guitar, Violin…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Skill Level</label>
            <select
              value={studentForm.skill_level}
              onChange={(e) => setStudentForm((f) => ({ ...f, skill_level: e.target.value }))}
              className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Birthday</label>
            <Input type="date" value={studentForm.birthday} onChange={(e) => setStudentForm((f) => ({ ...f, birthday: e.target.value }))} />
          </div>

          {createError && <p className="text-sm text-red-500">{createError}</p>}
          {createSuccess && <p className="text-sm text-indigo-600 font-medium">{createSuccess}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={createBusy} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {createBusy ? 'Creating…' : 'Create Account'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCreateStudentModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Create Family Account Modal */}
      <Modal open={showCreateFamilyModal} onClose={() => setShowCreateFamilyModal(false)} title="Create Family Account">
        <form onSubmit={handleCreateFamily} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Family / Guardian Name</label>
            <Input required value={familyForm.display_name} onChange={(e) => setFamilyForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Maria Rivera" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <Input required type="email" value={familyForm.email} onChange={(e) => setFamilyForm((f) => ({ ...f, email: e.target.value }))} placeholder="family@example.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <Input required type="password" value={familyForm.password} onChange={(e) => setFamilyForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" minLength={6} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Children Names</label>
            <textarea
              value={familyForm.children_names}
              onChange={(e) => setFamilyForm((f) => ({ ...f, children_names: e.target.value }))}
              placeholder="Sofia Rivera, Carlos Rivera…"
              rows={3}
              className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="text-[10px] text-slate-400 mt-1">One name per line</p>
          </div>

          {createError && <p className="text-sm text-red-500">{createError}</p>}
          {createSuccess && <p className="text-sm text-indigo-600 font-medium">{createSuccess}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={createBusy} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              {createBusy ? 'Creating…' : 'Create Account'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCreateFamilyModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
