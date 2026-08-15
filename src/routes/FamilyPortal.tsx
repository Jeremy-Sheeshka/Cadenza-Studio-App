// FamilyPortal.tsx — parent/guardian family portal.
// Light theme, professional, clean. 5 tabs: Overview, My Students, Billing, Messages, Calendar.
// Data fetched via api from serverApi.ts calling localhost:3001.

import { useEffect, useState, type FormEvent } from 'react'
import { api as baseApi } from '../lib/serverApi'
import { useTheme } from '../lib/theme'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui'
import type { Student, Family } from '../lib/types'
import {
  Home, Users, CreditCard, Mail, CalendarDays,
  LogOut, ChevronRight, TrendingUp, Music, Bell, FileText,
  Clock, CheckCircle, AlertCircle, DollarSign, Flame,
} from 'lucide-react'

// ── local fetch helpers (extends baseApi for family-portal routes) ──────────

const BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api'

async function safeGet<T>(path: string): Promise<T | null> {
  try {
    const token = localStorage.getItem('cadenza_token')
    const headers: Record<string,string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${BASE}${path}`, { headers })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch { return null }
}

async function safeGetList<T>(path: string): Promise<T[]> {
  try { const d = await safeGet<T[]>(path); return Array.isArray(d) ? d : [] }
  catch { return [] }
}

const api = {
  ...baseApi,
  getFamily: (familyId: string) => safeGet<any>(`/families/${familyId}`),
  getFamilyStudents: (familyId: string) => safeGetList<any>(`/families/${familyId}/students`),
  getFamilyInvoices: (familyId: string) => safeGetList<any>(`/families/${familyId}/invoices`),
  getFamilyPayments: (familyId: string) => safeGetList<any>(`/families/${familyId}/payments`),
  getFamilyMessages: (familyId: string) => safeGetList<any>(`/families/${familyId}/messages`),
  getFamilyActivity: (familyId: string) => safeGetList<any>(`/families/${familyId}/activity`),
  getStudentLessonNotes: (studentIds: string[]) =>
    safeGetList<any>(`/lesson-notes?student_ids=${studentIds.join(',')}`),
  getPracticeSummary: (studentIds: string[]) => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay())
    const weekStart = d.toISOString().slice(0, 10)
    return safeGetList<any>(`/practice-summary?student_ids=${studentIds.join(',')}&week_start=${weekStart}`)
  },
  getStudentEvents: (studentIds: string[]) =>
    safeGetList<any>(`/events?student_ids=${studentIds.join(',')}`),
}

// ── helpers ─────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const SKILL_COLORS: Record<string, string> = {
  beginner: 'bg-blue-50 text-blue-700 border-blue-200',
  intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  advanced: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

const STATUS_BADGE: Record<string, 'green' | 'amber' | 'slate' | 'red'> = {
  sent: 'amber', partially_paid: 'amber', paid: 'green', overdue: 'red', draft: 'slate', void: 'slate',
}

// ── FamilyLogin ──────────────────────────────────────────────────────────────

export function FamilyLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required.'); return }
    if (!password) { setError('Password is required.'); return }
    setBusy(true)
    setError(null)
    try {
      // 1. Authenticate with backend
      const data = await api.login(email.trim(), password)
      // 2. Store token in localStorage
      localStorage.setItem('cadenza_token', data.token)
      // 3. Fetch user profile for family info
      const user = await api.me()
      // 4. Store family session
      sessionStorage.setItem('cadenza_family_session', JSON.stringify({
        token: data.token,
        family: user.family ?? user,
        ...user,
      }))
      // 5. Redirect to family portal
      window.location.hash = '#/family-portal'
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your email and password.')
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
            <img src="/branding/logo.png" alt="Cadenza Studio" className="h-10 w-10 object-contain" />
          </span>
          <h1 className="text-3xl font-bold text-slate-800">Cadenza Family</h1>
          <p className="mt-2 text-slate-500">Stay connected with your student's progress</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Sign In</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="email"
                required
                placeholder="family@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-400">
            Need access? Contact your teacher.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── FamilyPortal ─────────────────────────────────────────────────────────────

type FamilyTab = 'overview' | 'students' | 'billing' | 'messages' | 'calendar'

const FAMILY_TABS: { key: FamilyTab; label: string; icon: typeof Home }[] = [
  { key: 'overview', label: 'Overview', icon: Home },
  { key: 'students', label: 'My Students', icon: Users },
  { key: 'billing', label: 'Billing', icon: CreditCard },
  { key: 'messages', label: 'Messages', icon: Mail },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
]

export function FamilyPortal() {
  const { toggle, isDark } = useTheme()
  const [tab, setTab] = useState<FamilyTab>('overview')
  const [family, setFamily] = useState<Family | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('cadenza_family_session')
    if (raw) {
      try {
        const session = JSON.parse(raw)
        // session from login has family info; fetch full data
        const famId = session.family?.id || session.family_id
        if (famId) {
          Promise.all([
            api.getFamily(famId),
            api.getFamilyStudents(famId),
          ]).then(([fam, studs]) => {
            setFamily(fam as Family | null)
            setStudents(studs as Student[])
            setReady(true)
          }).catch(() => setReady(true))
        } else {
          setFamily(session.family || session)
          setReady(true)
        }
      } catch { setReady(true) }
    } else {
      setReady(true)
    }
  }, [])

  const signOut = () => {
    sessionStorage.removeItem('cadenza_family_session')
    window.location.hash = '#/family-login'
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-sm text-slate-400">No family session found.</p>
        <a href="#/family-login" className="text-sm font-medium text-blue-700 hover:underline">
          Go to login
        </a>
      </div>
    )
  }

  const familyId = family.id
  const studentIds = students.map((s) => s.id)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm">
              <img src="/branding/logo.png" alt="Cadenza Studio" className="h-6 w-6 object-contain" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">Cadenza Family</p>
              <p className="text-[10px] text-slate-400">{family.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm"
                title={family.name}
              >
                {family.name.slice(0, 2).toUpperCase()}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{family.name}</p>
                      <p className="text-[11px] text-slate-500">Family account</p>
                    </div>
                    <div className="my-1 h-px bg-slate-100" />
                    <button
                      onClick={() => { toggle(); setMenuOpen(false) }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {isDark ? '☀️' : '🌙'} {isDark ? 'Light mode' : 'Dark mode'}
                    </button>
                    <button
                      onClick={() => { signOut(); setMenuOpen(false) }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab dock */}
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <nav className="inline-flex max-w-full items-center gap-1 overflow-x-auto scrollbar-none rounded-full bg-slate-100 p-1">
            {FAMILY_TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <p className="text-[11px] uppercase tracking-wider text-slate-400">
          Cadenza Family <span className="mx-1 text-slate-300">/</span>
          <span className="font-medium text-slate-600">{FAMILY_TABS.find((t) => t.key === tab)?.label}</span>
        </p>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        {tab === 'overview' && <OverviewTab family={family} students={students} studentIds={studentIds} />}
        {tab === 'students' && <StudentsTab students={students} studentIds={studentIds} />}
        {tab === 'billing' && <BillingTab familyId={familyId!} />}
        {tab === 'messages' && <MessagesTab familyId={familyId!} />}
        {tab === 'calendar' && <CalendarTab students={students} studentIds={studentIds} />}
      </div>
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ family, students, studentIds }: {
  family: Family; students: Student[]; studentIds: string[]
}) {
  const [activity, setActivity] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    Promise.all([
      api.getFamilyActivity(family.id),
      api.getStudentEvents(studentIds),
    ]).then(([act, evts]) => {
      setActivity((act ?? []).slice(0, 5))
      setEvents((evts ?? []).slice(0, 5))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [family.id, studentIds])

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  const activeStudentCount = students.filter(s => s.status === 'active').length

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {family.name}</h1>
        <p className="text-slate-500 text-sm mt-1">Here's what's happening with your family</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Users className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{activeStudentCount}</p>
              <p className="text-xs text-slate-500">Active Students</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Music className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{events.length}</p>
              <p className="text-xs text-slate-500">Lessons This Week</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">—</p>
              <p className="text-xs text-slate-500">Outstanding Balance</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
              <Mail className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">—</p>
              <p className="text-xs text-slate-500">New Messages</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity + Upcoming Lessons */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((a: any, i: number) => (
                <div key={a.id || i} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {a.type === 'lesson_note' && <FileText className="h-4 w-4 text-blue-400" />}
                    {a.type === 'invoice' && <DollarSign className="h-4 w-4 text-amber-400" />}
                    {a.type === 'message' && <Mail className="h-4 w-4 text-violet-400" />}
                    {a.type === 'assignment' && <CheckCircle className="h-4 w-4 text-indigo-400" />}
                    {a.type === 'event' && <CalendarDays className="h-4 w-4 text-blue-400" />}
                    {!a.type && <Bell className="h-4 w-4 text-slate-300" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{a.title || 'Activity'}</p>
                    {a.description && <p className="text-xs text-slate-400 line-clamp-1">{a.description}</p>}
                    {a.date && <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(a.date)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming Lessons */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Upcoming Lessons</h3>
            <CalendarDays className="h-4 w-4 text-blue-500" />
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming lessons.</p>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 5).map((ev: any) => {
                const start = new Date(ev.start_time)
                return (
                  <div key={ev.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-slate-300" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {ev.title ?? (ev.is_group ? ev.group_name ?? 'Group Lesson' : 'Lesson')}
                        </p>
                        <p className="text-xs text-slate-400">
                          {DAYS[start.getDay()]} {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {' · '}
                          {fmtTime(ev.start_time)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({ students, studentIds }: { students: Student[]; studentIds: string[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, any[]>>({})
  const [practice, setPractice] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    Promise.all([
      api.getStudentLessonNotes(studentIds),
      api.getPracticeSummary(studentIds),
    ]).then(([n, p]) => {
      const byStudent: Record<string, any[]> = {}
      if (Array.isArray(n)) {
        n.forEach((note: any) => {
          const sid = note.student_id
          if (sid) { if (!byStudent[sid]) byStudent[sid] = []; byStudent[sid].push(note) }
        })
      }
      setNotes(byStudent)
      setPractice(Array.isArray(p) ? p : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [studentIds])

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  if (students.length === 0) {
    return (
      <div>
        <PageHeader title="My Students" subtitle="Students linked to your family" />
        <EmptyState icon={Users} title="No students" description="Students linked to your family account will appear here" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="My Students" subtitle={`${students.length} student${students.length !== 1 ? 's' : ''}`} />
      <div className="space-y-4">
        {students.map((s) => {
          const expanded = expandedId === s.id
          const studentNotes = notes[s.id] ?? []
          const studentPractice = practice.find((p: any) => p.student_id === s.id)
          const upcomingLessons = 0 // would come from events query scoped to this student

          return (
            <Card key={s.id} className="overflow-hidden">
              <div
                className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setExpandedId(expanded ? null : s.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-800 font-bold text-lg">
                      {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">
                        {s.first_name} {s.last_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {s.instrument && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Music className="h-3 w-3" /> {s.instrument}
                          </span>
                        )}
                        {s.skill_level && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${SKILL_COLORS[s.skill_level] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {s.skill_level}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-lg font-bold text-slate-800">
                        {studentPractice?.total_minutes ?? 0}
                        <span className="text-xs font-normal text-slate-400"> min</span>
                      </p>
                      <p className="text-[10px] text-slate-400">Practice this week</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800">{upcomingLessons}</p>
                      <p className="text-[10px] text-slate-400">Upcoming</p>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-slate-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Mini progress bar */}
                {studentPractice && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((studentPractice.total_minutes ?? 0) / 60) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-slate-400">
                        {studentPractice.days_practiced ?? 0} days practiced
                      </span>
                      {studentPractice.goal_met && (
                        <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5">
                          <CheckCircle className="h-3 w-3" /> Goal met!
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-4">
                  {/* Recent Lesson Notes */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Lesson Notes</h4>
                    {studentNotes.length === 0 ? (
                      <p className="text-xs text-slate-400">No lesson notes yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {studentNotes.slice(0, 3).map((n: any) => (
                          <div key={n.id} className="text-sm">
                            <p className="font-medium text-slate-700">{n.title ?? `Note — ${fmtDate(n.lesson_date)}`}</p>
                            {n.body && (
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                {n.body.content?.map((node: any) => node.content?.map((c: any) => c.text).join(' ')).join(' ') ?? ''}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Practice History */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Practice</h4>
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-400" />
                      <span className="text-sm text-slate-700">
                        <strong>{s.practice_streak ?? 0}-day streak</strong>
                      </span>
                      <span className="text-xs text-slate-400">· {s.total_practice_minutes ?? 0} total min</span>
                    </div>
                  </div>

                  {/* Assignments placeholder */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.status === 'active' ? 'green' : 'slate'}>
                        {s.status}
                      </Badge>
                      {s.level > 0 && (
                        <span className="text-xs text-slate-500">
                          Level {s.level} · {s.points ?? 0} XP
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTab({ familyId }: { familyId: string }) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getFamilyInvoices(familyId),
      api.getFamilyPayments(familyId),
    ]).then(([inv, pay]) => {
      setInvoices(inv ?? [])
      setPayments(pay ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [familyId])

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  const totalOutstanding = invoices
    .filter((i: any) => ['sent', 'partially_paid', 'overdue'].includes(i.status))
    .reduce((sum: number, i: any) => sum + (i.balance_due ?? 0), 0)

  const lastPayment = payments.length > 0 ? payments[0] : null

  return (
    <div>
      <PageHeader title="Billing" subtitle="Invoices & payment history" />

      {/* Summary bar */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{fmtCents(totalOutstanding)}</p>
              <p className="text-xs text-slate-500">Total Outstanding</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <CheckCircle className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {lastPayment ? fmtCents(lastPayment.amount) : '—'}
              </p>
              <p className="text-xs text-slate-500">
                Last Payment{lastPayment ? ` · ${fmtDate(lastPayment.payment_date)}` : ''}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Invoices */}
      {invoices.length === 0 && payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No invoices" description="Billing history will appear here" />
      ) : (
        <div className="space-y-6">
          {/* Invoice list */}
          {invoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Invoices</h3>
              <div className="space-y-2">
                {invoices.map((inv: any) => (
                  <Card key={inv.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{inv.title ?? inv.invoice_number}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {fmtDate(inv.due_date)} · {inv.invoice_number}
                        </p>
                        {inv.notes && <p className="mt-1 text-xs text-slate-400 line-clamp-1">{inv.notes}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={STATUS_BADGE[inv.status] ?? 'slate'}>
                          {inv.status.replace(/_/g, ' ')}
                        </Badge>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{fmtCents(inv.total)}</p>
                      </div>
                    </div>
                    {(inv.amount_paid > 0 || inv.balance_due > 0) && (
                      <div className="mt-2 flex items-center gap-3 text-xs border-t border-slate-100 pt-2">
                        {inv.amount_paid > 0 && <span className="text-indigo-600">Paid {fmtCents(inv.amount_paid)}</span>}
                        {inv.balance_due > 0 && <span className="text-red-500 font-medium">Balance {fmtCents(inv.balance_due)}</span>}
                        {inv.balance_due <= 0 && inv.status === 'paid' && (
                          <span className="text-indigo-600 font-medium">Paid in full</span>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Payment history */}
          {payments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Payment History</h3>
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <Card key={p.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{fmtCents(p.amount)}</p>
                      <p className="text-xs text-slate-400">
                        {fmtDate(p.payment_date)} · {p.payment_method ?? 'payment'}
                        {p.reference_number && ` · ref: ${p.reference_number}`}
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-indigo-400" />
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Messages Tab ─────────────────────────────────────────────────────────────

function MessagesTab({ familyId }: { familyId: string }) {
  const [messages, setMessages] = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getFamilyMessages(familyId)
      .then((msgs) => setMessages(msgs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [familyId])

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div>
      <PageHeader title="Messages" subtitle="Communication from your teacher" />
      {messages.length === 0 ? (
        <EmptyState icon={Mail} title="No messages" description="Messages from your teacher will appear here" />
      ) : (
        <div className="space-y-2">
          {messages.map((m: any) => {
            const expanded = expandedId === m.id
            const isUnread = !m.read_at
            return (
              <Card key={m.id} className="overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : m.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isUnread ? (
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      ) : (
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-sm ${isUnread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                          {m.sender_type === 'teacher' ? 'Teacher' : 'You'}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">{fmtDate(m.created_at)}</span>
                      </div>
                      <p className={`mt-0.5 text-xs line-clamp-2 ${isUnread ? 'text-slate-600' : 'text-slate-400'}`}>
                        {m.body?.length > 120 ? m.body.slice(0, 120) + '…' : m.body}
                      </p>
                    </div>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-2 text-[10px] text-slate-400">
                      {fmtDate(m.created_at)} · {m.sender_type === 'teacher' ? 'From teacher' : 'From you'}
                    </p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab({ students, studentIds }: { students: Student[]; studentIds: string[] }) {
  const [events, setEvents] = useState<any[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    api.getStudentEvents(studentIds)
      .then((evts) => setEvents(evts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentIds])

  // Color map per student
  const studentColors = ['#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#65a30d']
  const studentColorMap: Record<string, string> = {}
  students.forEach((s, i) => { studentColorMap[s.id] = studentColors[i % studentColors.length] })

  // Calendar grid helpers
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Map events by date string
  const eventsByDate: Record<string, any[]> = {}
  events.forEach((ev: any) => {
    const d = ev.start_time?.slice(0, 10)
    if (d) {
      if (!eventsByDate[d]) eventsByDate[d] = []
      eventsByDate[d].push(ev)
    }
  })

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : []

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Lessons & events across all students" />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Calendar grid */}
        <Card className="p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight className="h-5 w-5 text-slate-400 rotate-180" />
            </button>
            <h3 className="text-base font-semibold text-slate-800">
              {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white p-2 min-h-[60px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = eventsByDate[dateStr] ?? []
              const isSelected = selectedDate === dateStr
              const isToday = dateStr === new Date().toISOString().slice(0, 10)

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`bg-white p-2 min-h-[60px] cursor-pointer transition-colors hover:bg-slate-50 ${
                    isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    isToday
                      ? 'flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white'
                      : 'text-slate-600'
                  }`}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {dayEvents.slice(0, 3).map((ev: any) => (
                        <span
                          key={ev.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: studentColorMap[ev.student_id] ?? '#94a3b8' }}
                          title={ev.title ?? 'Lesson'}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] text-slate-400">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Student color legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {students.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: studentColors[i % studentColors.length] }}
                />
                <span className="text-[10px] text-slate-500">{s.first_name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Selected day events */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            {selectedDate
              ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
              : 'Select a day'}
          </h3>
          {selectedDate && selectedEvents.length === 0 ? (
            <p className="text-xs text-slate-400">No lessons on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev: any) => {
                const st = students.find((s) => s.id === ev.student_id)
                return (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl border"
                    style={{ borderLeftColor: studentColorMap[ev.student_id] ?? '#94a3b8', borderLeftWidth: '3px' }}
                  >
                    <p className="text-sm font-medium text-slate-700">
                      {ev.title ?? (ev.is_group ? ev.group_name ?? 'Group Lesson' : 'Lesson')}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtTime(ev.start_time)} – {fmtTime(ev.end_time)}
                    </p>
                    {st && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {st.first_name} {st.last_name} · {st.instrument}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FamilyPortal
