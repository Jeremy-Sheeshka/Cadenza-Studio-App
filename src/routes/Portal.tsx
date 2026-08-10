// /student-login + /student-portal — family/student portal.
// Production: portal_session model; access rows in student_portal_access.
// Native app hands off via #handoff= → sessionStorage cadenza_portal_web_handoff.
// Portal shows practice, lesson notes, assignments, schedule, billing, resources, forms.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { db } from '../lib/api'
import { api } from '../lib/serverApi'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui'
import type {
  Assignment, AssignmentStudent, Family, Form, Invoice, LessonNote,
  Resource, Student, StudentResource,
  WeeklyPracticeSummary, CalendarEvent, FormSubmission,
} from '../lib/types'
import {
  Mail, Lock, Eye, EyeOff, LogOut,
  LayoutDashboard, CalendarDays, FileText, ClipboardList,
  CreditCard, FolderOpen, FormInput,
  Trophy, TrendingUp, Music, Bell, ChevronRight, ExternalLink, Clock,
  Flame, Star, Zap, Sparkles, Search, Download, Play, BookOpen, CheckCircle,
} from 'lucide-react'

// ─── helpers ─────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'green' | 'amber' | 'slate' | 'red'> = {
  sent: 'amber', partially_paid: 'amber', paid: 'green', overdue: 'red', draft: 'slate', void: 'slate',
  assigned: 'amber', in_progress: 'amber', submitted: 'green', graded: 'green',
  scheduled: 'amber', completed: 'green', cancelled: 'slate', no_show: 'red',
}

// ─── StudentLogin ────────────────────────────────────────────────────────────

export function StudentLogin() {
  const {} = useAuth() // auth context available, student login uses direct api
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // on successful portal login, store token, fetch user, and navigate
  const doPortalLogin = useCallback(async (portalEmail: string, portalPassword: string) => {
    setBusy(true)
    setError(null)
    try {
      // 1. Authenticate with backend
      const data = await api.login(portalEmail, portalPassword)
      // 2. Store token
      localStorage.setItem('cadenza_token', data.token)
      // 3. Fetch user profile
      const user = await api.me()
      // 4. Navigate based on account_type
      if (user.account_type === 'student') {
        // store portal session for the student portal page
        sessionStorage.setItem('cadenza_portal_family', JSON.stringify(user.family ?? null))
        sessionStorage.setItem('cadenza_portal_access', JSON.stringify(user))
        window.location.hash = '#/student-portal'
      } else if (user.account_type === 'family') {
        sessionStorage.setItem('cadenza_family_session', JSON.stringify({ token: data.token, family: user.family ?? user, ...user }))
        window.location.hash = '#/family-portal'
      } else {
        setError('This login is for students and families only.')
        localStorage.removeItem('cadenza_token')
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your email and password.')
    }
    setBusy(false)
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required.'); return }
    if (!password) { setError('Password is required.'); return }
    await doPortalLogin(email.trim(), password)
  }

  // handoff code from native app
  useEffect(() => {
    const code = sessionStorage.getItem('cadenza_portal_web_handoff')
    if (code) {
      sessionStorage.removeItem('cadenza_portal_web_handoff')
      // In production, exchange code for portal session.
      // For mock, pre-fill with a known email.
    }
  }, [])

  const google = async () => {
    setError('Google sign-in is coming soon. Please use email and password.')
  }
  const apple = async () => {
    setError('Apple sign-in is coming soon. Please use email and password.')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl font-bold text-white">
            <img src="/branding/logo.png" alt="Cadenza Studio" className="h-10 w-10 object-contain" />
          </span>
          <h1 className="text-3xl font-bold text-white">Family Portal</h1>
          <p className="mt-2 text-slate-400">Access your lessons and resources</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="email"
                required
                placeholder="family@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                className="w-full pl-10 pr-12 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <span className="h-px flex-1 bg-slate-600" />
            <span className="px-3 text-sm text-slate-500">or</span>
            <span className="h-px flex-1 bg-slate-600" />
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void google()}
              disabled
              className="w-full flex items-center justify-center gap-2 border border-slate-600 bg-white text-slate-900 hover:bg-gray-100 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => void apple()}
              disabled
              className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-slate-800 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Continue with Apple
            </button>
          </div>
        </div>

        {/* Bottom link */}
        <p className="mt-6 text-center text-slate-400 text-sm">
          Need portal access?{' '}
          <span className="font-medium text-blue-400 cursor-pointer hover:underline">Learn how</span>
        </p>
      </div>
    </div>
  )
}

// ─── StudentPortal ───────────────────────────────────────────────────────────

type Tab = 'home' | 'practice' | 'schedule' | 'notes' | 'assignments' | 'billing' | 'resources' | 'forms'

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'home', label: 'Home', icon: LayoutDashboard },
  { key: 'practice', label: 'Practice', icon: Music },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'notes', label: 'Notes', icon: FileText },
  { key: 'assignments', label: 'Assignments', icon: ClipboardList },
  { key: 'billing', label: 'Billing', icon: CreditCard },
  { key: 'resources', label: 'Resources', icon: FolderOpen },
  { key: 'forms', label: 'Forms', icon: FormInput },
]

export function StudentPortal() {
  const { toggle, isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('home')

  // family from session (set by StudentLogin)
  const [family, setFamily] = useState<Family | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // gamified mode toggle
  const [gamified, setGamified] = useState(() => {
    const stored = localStorage.getItem('cadenza_gamified_mode')
    return stored === 'true'
  })

  const toggleGamified = () => {
    const next = !gamified
    setGamified(next)
    localStorage.setItem('cadenza_gamified_mode', String(next))
  }

  // ── init: read family from sessionStorage ────────────────────────────────

  useEffect(() => {
    const raw = sessionStorage.getItem('cadenza_portal_family')
    if (raw) {
      try {
        const fam = JSON.parse(raw) as Family
        setFamily(fam)
        // load students for this family
        db.from('students')
          .select('*')
          .eq('family_id', fam.id)
          .eq('status', 'active')
          .order('first_name', { ascending: true })
          .then(({ data }: { data: Student[] | null }) => {
            const list = data ?? []
            setStudents(list)
            if (list.length > 0) setSelectedStudentId(list[0].id)
            setReady(true)
          })
          .catch(() => setReady(true))
      } catch { setReady(true) }
    } else {
      // no family session — redirect to login
      setReady(true)
    }
  }, [])

  // ── shared data ──────────────────────────────────────────────────────────

  const familyId = family?.id
  const studentIds = students.map((s) => s.id)
  const selId = selectedStudentId

  const signOut = () => {
    sessionStorage.removeItem('cadenza_portal_family')
    sessionStorage.removeItem('cadenza_portal_access')
    window.location.hash = '#/student-login'
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 px-4">
        <p className="text-sm text-slate-400">No portal session found.</p>
        <a href="#/student-login" className="text-sm font-medium text-blue-400 hover:underline">
          Go to login
        </a>
      </div>
    )
  }

  const selectedStudent = students.find((s) => s.id === selId)

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-20 backdrop-blur-xl border-b ${
        isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/80 border-slate-200'
      }`}>
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
              <img src="/branding/logo.png" alt="Cadenza Studio" className="h-6 w-6 object-contain" />
            </span>
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Cadenza</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{family.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {students.length > 1 && (
              <select
                className={`h-9 rounded-lg border px-3 text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-slate-800/50 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                value={selId ?? ''}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
              </select>
            )}

            {/* Gamified toggle */}
            <button
              onClick={toggleGamified}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                gamified
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/30'
                  : `${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`
              }`}
            >
              {gamified ? <Zap className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
              {gamified ? 'Gamified 🎮' : 'Standard 📋'}
            </button>

            {/* Theme toggle */}
            <button onClick={toggle} className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
              {isDark ? '☀️' : '🌙'}
            </button>

            <button
              onClick={signOut}
              className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mx-auto max-w-5xl px-2">
          <nav className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex shrink-0 items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? 'border-blue-500 text-blue-400'
                      : `border-transparent transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`
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

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        {tab === 'home' && <HomeTab studentIds={studentIds} selId={selId} students={students} selectedStudent={selectedStudent} family={family} gamified={gamified} />}
        {tab === 'practice' && <PracticeTab studentIds={studentIds} students={students} gamified={gamified} />}
        {tab === 'schedule' && <ScheduleTab studentIds={studentIds} />}
        {tab === 'notes' && <NotesTab studentIds={studentIds} />}
        {tab === 'assignments' && <AssignmentsTab studentIds={studentIds} />}
        {tab === 'billing' && <BillingTab familyId={familyId!} />}
        {tab === 'resources' && <ResourcesTab studentIds={studentIds} />}
        {tab === 'forms' && <FormsTab familyId={familyId!} studentIds={studentIds} />}
      </div>
    </div>
  )
}

// ─── Home Tab ────────────────────────────────────────────────────────────────

function HomeTab({ studentIds, selId, students, selectedStudent, family, gamified }: {
  studentIds: string[]
  selId: string | null
  students: Student[]
  selectedStudent?: Student
  family: Family
  gamified: boolean
}) {
  const { isDark } = useTheme()
  const [summaries, setSummaries] = useState<WeeklyPracticeSummary[]>([])
  const [notes, setNotes] = useState<LessonNote[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Lesson check-in state
  const [checkedInEventId, setCheckedInEventId] = useState<string | null>(null)
  const [checkinTime, setCheckinTime] = useState<string | null>(null)
  const [checkinBusy, setCheckinBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Elapsed timer after check-in
  useEffect(() => {
    if (!checkinTime) return
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(checkinTime).getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [checkinTime])

  // Find today's closest upcoming event for check-in
  const now = new Date()
  const todayEvents = events.filter((ev) => {
    const start = new Date(ev.start_time)
    return start.toDateString() === now.toDateString()
  })
  const todayEvent = todayEvents.length > 0 ? todayEvents[0] : null

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    const weekStart = d.toISOString().slice(0, 10)
    const nowISO = new Date().toISOString()

    Promise.all([
      db.from('weekly_practice_summary')
        .select('*')
        .in('student_id', studentIds)
        .eq('week_start', weekStart)
        .then((r: { data: WeeklyPracticeSummary[] | null }) => r.data ?? []),
      db.from('lesson_notes')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'published')
        .order('lesson_date', { ascending: false })
        .limit(5)
        .then((r: { data: LessonNote[] | null }) => r.data ?? []),
      db.from('events')
        .select('*')
        .in('student_id', studentIds)
        .gte('start_time', nowISO)
        .order('start_time', { ascending: true })
        .limit(5)
        .then((r: { data: CalendarEvent[] | null }) => r.data ?? []),
    ])
      .then(([s, n, e]) => { setSummaries(s); setNotes(n); setEvents(e) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentIds])

  const handleCheckin = async () => {
    if (!todayEvent || checkinBusy) return
    setCheckinBusy(true)
    try {
      const result = await api.checkin(todayEvent.id)
      if (result) {
        setCheckedInEventId(todayEvent.id)
        setCheckinTime(new Date().toISOString())
      }
    } catch {}
    setCheckinBusy(false)
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  const filteredSummaries = selId ? summaries.filter((s) => s.student_id === selId) : summaries
  const totalMinutes = filteredSummaries.reduce((acc, s) => acc + (s.total_minutes ?? 0), 0)
  const totalDays = filteredSummaries.reduce((acc, s) => acc + (s.days_practiced ?? 0), 0)
  const goalMet = filteredSummaries.some((s) => s.goal_met)

  // Gamified calculations
  const totalXP = totalMinutes * 10
  const level = Math.min(50, Math.floor(Math.sqrt(totalXP / 100)) + 1)
  const xpForNext = (level * level) * 100
  const xpProgress = Math.min(100, Math.round((totalXP / xpForNext) * 100))
  const hasStreak = (selectedStudent?.practice_streak ?? 0) >= 7
  const hasRecital = (selectedStudent?.level ?? 0) >= 10

  // Card classes based on mode and theme
  const cardBg = gamified
    ? (isDark ? '!bg-slate-800/60 !border-slate-700/40 backdrop-blur-sm' : '!bg-white !border-slate-200')
    : (isDark ? '!bg-slate-800/50 !border-slate-700/50' : '!bg-white !border-slate-200')

  return (
    <div className={`space-y-6 ${gamified ? 'gamified' : ''}`}>
      {/* Welcome */}
      <div>
        <h1 className={`text-2xl font-bold ${gamified ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 bg-clip-text text-transparent' : (isDark ? 'text-white' : 'text-slate-800')}`}>
          {gamified ? '🎵 ' : ''}Welcome back{selectedStudent ? `, ${selectedStudent.first_name}` : ''}{gamified ? '! 🎵' : ''}
        </h1>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{family.name}</p>
      </div>

      {/* ── Gamified: Level + XP bar ─────────────────────────────────────── */}
      {gamified && (
        <Card className={`${cardBg} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-lg shadow-lg shadow-amber-500/20">
                {level}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Level {level}</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{totalXP} XP · {xpForNext - totalXP} XP to next level</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              <span className="text-lg font-bold text-amber-400">{totalXP} XP</span>
            </div>
          </div>
          {/* XP progress bar */}
          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${xpProgress}%` }}
            />
          </div>

          {/* Achievement badges row */}
          <div className="flex items-center gap-3 mt-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Achievements</span>
            {hasStreak && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-[10px] font-medium text-orange-400"
                title="7-day practice streak!">
                🔥 7-Day Streak
              </span>
            )}
            {totalDays >= 10 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-medium text-amber-400"
                title="10 assignments completed!">
                ⭐ 10 Assignments
              </span>
            )}
            {hasRecital && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-[10px] font-medium text-purple-400"
                title="Recital milestone reached!">
                🏆 Recital Star
              </span>
            )}
            {!hasStreak && totalDays < 10 && !hasRecital && (
              <span className="text-[10px] text-slate-500">Keep practicing to earn badges!</span>
            )}
          </div>
        </Card>
      )}

      {/* ── Lesson Check-In ──────────────────────────────────────────────── */}
      {todayEvent && !checkedInEventId ? (
        <Card className={`${cardBg} p-4`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                <CheckCircle className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Today's Lesson</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {todayEvent.title ?? 'Lesson'} · {new Date(todayEvent.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <button
              onClick={handleCheckin}
              disabled={checkinBusy}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-700 text-white text-sm font-semibold hover:from-indigo-600 hover:to-blue-800 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              {checkinBusy ? 'Checking in…' : "I'm at my lesson!"}
            </button>
          </div>
        </Card>
      ) : checkedInEventId ? (
        <Card className={`${cardBg} p-4 border-indigo-500/30`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-400">Lesson in progress…</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Checked in at {checkinTime ? new Date(checkinTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''}
                {' · '}
                {Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── Standard: Calendar-forward layout ────────────────────────────── */}
      {!gamified && todayEvent && (
        <Card className={`${cardBg} p-4`}>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-blue-400" />
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Today: {todayEvent.title ?? 'Lesson'} at {new Date(todayEvent.start_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={`${cardBg} p-4 ${gamified ? 'hover:shadow-amber-500/10 transition-shadow' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gamified ? 'bg-amber-500/20' : (isDark ? 'bg-amber-500/10' : 'bg-amber-50')}`}>
              <Trophy className={`h-5 w-5 ${gamified ? 'text-amber-300' : 'text-amber-400'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{totalDays}</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Day Streak</p>
            </div>
          </div>
        </Card>

        <Card className={`${cardBg} p-4 ${gamified ? 'hover:shadow-blue-500/10 transition-shadow' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gamified ? 'bg-blue-500/20' : (isDark ? 'bg-blue-500/10' : 'bg-blue-50')}`}>
              <TrendingUp className={`h-5 w-5 ${gamified ? 'text-blue-300' : 'text-blue-400'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{totalMinutes}</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Min This Week</p>
            </div>
          </div>
        </Card>

        <Card className={`${cardBg} p-4 ${gamified ? 'hover:shadow-blue-500/10 transition-shadow' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gamified ? 'bg-blue-500/20' : (isDark ? 'bg-blue-500/10' : 'bg-blue-50')}`}>
              <Music className={`h-5 w-5 ${gamified ? 'text-blue-300' : 'text-blue-400'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{events.length}</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Upcoming Lessons</p>
            </div>
          </div>
        </Card>

        <Card className={`${cardBg} p-4 ${gamified ? 'hover:shadow-indigo-500/10 transition-shadow' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gamified ? 'bg-indigo-500/20' : (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50')}`}>
              <Bell className={`h-5 w-5 ${gamified ? 'text-emerald-300' : 'text-indigo-400'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{goalMet ? 'Yes! 🎉' : 'Soon'}</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Goal Met</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Weekly practice + upcoming lessons row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Practice */}
        <Card className={`${cardBg} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Practice This Week</h3>
            <TrendingUp className={`h-4 w-4 ${gamified ? 'text-amber-400' : 'text-blue-400'}`} />
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>{totalMinutes} min</span>
              <span>Goal: 60 min</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
              <div
                className={`h-full rounded-full transition-all ${gamified ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                style={{ width: `${Math.min(100, (totalMinutes / 60) * 100)}%` }}
              />
            </div>
          </div>

          {filteredSummaries.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No practice data yet this week.</p>
          ) : (
            <div className="space-y-3">
              {filteredSummaries.map((s) => {
                const st = students.find((x) => x.id === s.student_id)
                return (
                  <div key={s.student_id} className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {st ? `${st.first_name} ${st.last_name}` : `Student ${s.student_id.slice(-4)}`}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.total_minutes} min · {s.days_practiced} days</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {gamified && s.goal_met && <Flame className="h-4 w-4 text-orange-400" />}
                      <Badge variant={s.goal_met ? 'green' : 'amber'}>
                        {s.goal_met ? 'Goal met' : 'In progress'}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Upcoming lessons */}
        <Card className={`${cardBg} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Upcoming Lessons</h3>
            <CalendarDays className={`h-4 w-4 ${gamified ? 'text-amber-400' : 'text-blue-400'}`} />
          </div>
          {events.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No upcoming lessons.</p>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 3).map((ev) => {
                const start = new Date(ev.start_time)
                return (
                  <div key={ev.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {ev.title ?? (ev.is_group ? ev.group_name ?? 'Group Lesson' : 'Lesson')}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {DAYS[start.getDay()]} {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {' · '}
                          {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent notes */}
      <Card className={`${cardBg} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Recent Notes</h3>
          <FileText className={`h-4 w-4 ${gamified ? 'text-amber-400' : 'text-blue-400'}`} />
        </div>
        {notes.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No lesson notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.slice(0, 3).map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {n.title ?? `Note — ${fmtDate(n.lesson_date)}`}
                  </p>
                  {n.body && (
                    <p className={`mt-0.5 text-xs line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {n.body.content?.map((node: any) => node.content?.map((c: any) => c.text).join(' ')).join(' ') ?? ''}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDate(n.published_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Practice Tab ────────────────────────────────────────────────────────────

function PracticeTab({ studentIds, students, gamified }: {
  studentIds: string[]
  students: Student[]
  gamified: boolean
}) {
  const { isDark } = useTheme()
  const [summaries, setSummaries] = useState<WeeklyPracticeSummary[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    const weekStart = d.toISOString().slice(0, 10)
    const now = new Date().toISOString()

    Promise.all([
      db.from('weekly_practice_summary')
        .select('*')
        .in('student_id', studentIds)
        .eq('week_start', weekStart)
        .then((r: { data: WeeklyPracticeSummary[] | null }) => r.data ?? []),
      db.from('events')
        .select('*')
        .in('student_id', studentIds)
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .limit(10)
        .then((r: { data: CalendarEvent[] | null }) => r.data ?? []),
    ])
      .then(([s, e]) => { setSummaries(s); setEvents(e) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentIds])

  if (loading) return <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading…</p>

  const cardBg = gamified
    ? (isDark ? '!bg-slate-800/60 !border-slate-700/40' : '!bg-white !border-slate-200')
    : (isDark ? '!bg-slate-800/50 !border-slate-700/50' : '!bg-white !border-slate-200')

  return (
    <div className="space-y-6">
      <PageHeader title="Practice" subtitle="Your weekly practice at a glance" />

      {/* Per-student practice cards */}
      {summaries.length === 0 ? (
        <EmptyState icon={Music} title="No practice data yet" description="Start practicing to see your stats here!" />
      ) : (
        <div className="space-y-4">
          {summaries.map((s) => {
            const st = students.find((x) => x.id === s.student_id)
            const pct = Math.min(100, Math.round(((s.total_minutes ?? 0) / 60) * 100))
            const xp = (s.total_minutes ?? 0) * 10

            return (
              <Card key={s.student_id} className={`${cardBg} p-5`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {st ? `${st.first_name} ${st.last_name}` : `Student ${s.student_id.slice(-4)}`}
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {s.days_practiced ?? 0} days practiced this week
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {gamified && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-amber-400">{xp} XP</p>
                        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>earned</p>
                      </div>
                    )}
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.goal_met ? (isDark ? 'bg-indigo-500/20' : 'bg-indigo-50') : (isDark ? 'bg-amber-500/10' : 'bg-amber-50')}`}>
                      <Flame className={`h-5 w-5 ${s.goal_met ? 'text-indigo-400' : 'text-amber-400'}`} />
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>{s.total_minutes ?? 0} min</span>
                    <span>Goal: 60 min/week</span>
                  </div>
                  <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        gamified
                          ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400'
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Streak counter */}
                <div className={`flex items-center gap-4 mt-3 pt-3 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-1.5">
                    <Flame className={`h-4 w-4 ${(st?.practice_streak ?? 0) >= 7 ? 'text-orange-400' : (isDark ? 'text-slate-500' : 'text-slate-400')}`} />
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{st?.practice_streak ?? 0}</span>
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>day streak</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{st?.longest_practice_streak ?? 0}</span>
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>best streak</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{st?.total_practice_minutes ?? 0}</span>
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>total min</span>
                  </div>
                  {gamified && (
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-purple-400" />
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{st?.level ?? 0}</span>
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>level</span>
                    </div>
                  )}
                </div>

                {/* Goal badge */}
                <div className="mt-2">
                  {s.goal_met ? (
                    <Badge variant="green">🎉 Weekly goal met!</Badge>
                  ) : (
                    <Badge variant="amber">Keep going — you're {Math.max(0, 60 - (s.total_minutes ?? 0))} min away</Badge>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Upcoming lessons (context for practice motivation) */}
      {events.length > 0 && (
        <Card className={`${cardBg} p-5`}>
          <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Upcoming Lessons</h3>
          <div className="space-y-2">
            {events.slice(0, 5).map((ev) => {
              const start = new Date(ev.start_time)
              return (
                <div key={ev.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarDays className={`h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                      {DAYS[start.getDay()]} {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {' · '}
                      {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {ev.title ?? 'Lesson'}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Schedule Tab ────────────────────────────────────────────────────────────

function ScheduleTab({ studentIds }: { studentIds: string[] }) {
  const { isDark } = useTheme()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    const now = new Date().toISOString()
    db.from('events')
      .select('*')
      .in('student_id', studentIds)
      .gte('start_time', now)
      .order('start_time', { ascending: true })
      .limit(50)
      .then(({ data }: { data: CalendarEvent[] | null }) => setEvents(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentIds])

  if (loading) return <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading…</p>

  const cardBg = isDark ? '!bg-slate-800/50 !border-slate-700/50' : ''

  return (
    <div>
      <PageHeader title="Schedule" subtitle="Upcoming lessons & events" />
      {events.length === 0 ? (
        <EmptyState title="No upcoming events" description="Scheduled lessons will appear here" />
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const start = new Date(ev.start_time)
            return (
              <Card key={ev.id} className={`${cardBg} flex items-center justify-between gap-3 p-4`}>
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {ev.title ?? (ev.is_group ? ev.group_name ?? 'Group Lesson' : 'Lesson')}
                  </p>
                  <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {DAYS[start.getDay()]} {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {' · '}
                    {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    {' – '}
                    {new Date(ev.end_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[ev.status] ?? 'slate'}>{ev.status}</Badge>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Notes Tab ───────────────────────────────────────────────────────────────

function NotesTab({ studentIds }: { studentIds: string[] }) {
  const { isDark } = useTheme()
  const [notes, setNotes] = useState<LessonNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    db.from('lesson_notes')
      .select('*')
      .in('student_id', studentIds)
      .eq('status', 'published')
      .order('lesson_date', { ascending: false })
      .limit(50)
      .then(({ data }: { data: LessonNote[] | null }) => setNotes(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentIds])

  if (loading) return <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading…</p>

  const cardBg = isDark ? '!bg-slate-800/50 !border-slate-700/50' : ''

  return (
    <div>
      <PageHeader title="Lesson Notes" subtitle="Published notes from your teacher" />
      {notes.length === 0 ? (
        <EmptyState title="No lesson notes yet" description="Published notes will appear here" />
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <Card key={n.id} className={`${cardBg} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {n.title ?? `Note — ${fmtDate(n.lesson_date)}`}
                  </p>
                  {n.body && (
                    <p className={`mt-1 text-xs line-clamp-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {n.body.content?.map((node: any) => node.content?.map((c: any) => c.text).join(' ')).join(' ') ?? ''}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDate(n.published_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Assignments Tab ─────────────────────────────────────────────────────────

function AssignmentsTab({ studentIds }: { studentIds: string[] }) {
  const { isDark } = useTheme()
  const [items, setItems] = useState<(AssignmentStudent & { assignment?: Assignment | null })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    db.from('assignment_students')
      .select('*,assignment:assignments(*)')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }: { data: (AssignmentStudent & { assignment?: Assignment | null })[] | null }) =>
        setItems(data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentIds])

  if (loading) return <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading…</p>

  const cardBg = isDark ? '!bg-slate-800/50 !border-slate-700/50' : ''

  return (
    <div>
      <PageHeader title="Assignments" subtitle="Current & past assignments" />
      {items.length === 0 ? (
        <EmptyState title="No assignments" description="Assignments from your teacher will appear here" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className={`${cardBg} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {a.assignment?.title ?? 'Assignment'}
                  </p>
                  {a.assignment?.description && (
                    <p className={`mt-0.5 text-xs line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a.assignment.description}</p>
                  )}
                  {a.assignment?.due_date && (
                    <p className={`mt-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Due: {fmtDate(a.assignment.due_date)}</p>
                  )}
                </div>
                <Badge variant={STATUS_BADGE[a.status] ?? 'slate'}>
                  {a.status.replace('_', ' ')}
                </Badge>
              </div>
              {a.teacher_feedback && (
                <div className={`mt-2 rounded-lg p-2 text-xs ${isDark ? 'bg-slate-900/50 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  <span className="font-medium">Feedback: </span>{a.teacher_feedback}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab({ familyId }: { familyId: string }) {
  const { isDark } = useTheme()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.from('invoices')
      .select('*')
      .eq('family_id', familyId)
      .order('due_date', { ascending: false })
      .limit(50)
      .then(({ data }: { data: Invoice[] | null }) => setInvoices(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [familyId])

  if (loading) return <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading…</p>

  const cardBg = isDark ? '!bg-slate-800/50 !border-slate-700/50' : ''

  return (
    <div>
      <PageHeader title="Billing" subtitle="Invoices & payments" />
      {invoices.length === 0 ? (
        <EmptyState title="No invoices" description="Billing history will appear here" />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Card key={inv.id} className={`${cardBg} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{inv.title ?? inv.invoice_number}</p>
                  <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {fmtDate(inv.due_date)} · {inv.invoice_number}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[inv.status] ?? 'slate'}>{inv.status.replace('_', ' ')}</Badge>
              </div>
              <div className={`mt-3 flex items-end justify-between border-t pt-3 ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {inv.amount_paid > 0 && <span>Paid {fmtCents(inv.amount_paid)} · </span>}
                  {inv.balance_due > 0 && <span className="font-medium text-red-400">Balance {fmtCents(inv.balance_due)}</span>}
                  {inv.balance_due <= 0 && <span className="font-medium text-indigo-400">Paid in full</span>}
                </div>
                <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmtCents(inv.total)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Resources Tab ───────────────────────────────────────────────────────────

function ResourcesTab({ studentIds }: { studentIds: string[] }) {
  const { isDark } = useTheme()
  const [items, setItems] = useState<(StudentResource & { resource?: Resource | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    db.from('student_resources')
      .select('*,resource:resources(*)')
      .in('student_id', studentIds)
      .order('assigned_at', { ascending: false })
      .limit(50)
      .then(({ data }: { data: (StudentResource & { resource?: Resource | null })[] | null }) =>
        setItems(data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentIds])

  // Search handler — debounced
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await api.searchResources(searchQuery.trim())
        setSearchResults(Array.isArray(results) ? results : [])
      } catch { setSearchResults([]) }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  if (loading) return <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading…</p>

  const cardBg = isDark ? '!bg-slate-800/50 !border-slate-700/50' : ''

  // Determine file type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sheet_music': return <Music className="h-4 w-4 text-blue-400" />
      case 'audio': return <Play className="h-4 w-4 text-indigo-400" />
      case 'video': return <Play className="h-4 w-4 text-purple-400" />
      case 'pdf': return <FileText className="h-4 w-4 text-red-400" />
      default: return <Download className="h-4 w-4 text-slate-400" />
    }
  }

  const showSearch = searchQuery.trim().length > 0
  const displayItems = showSearch ? searchResults : items

  return (
    <div>
      <PageHeader title="Resources" subtitle="Files & materials from your teacher" />

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your music library..."
          className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'}`}
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showSearch && searchResults.length === 0 && !searching ? (
        <EmptyState icon={Search} title="No results found" description={`No resources match "${searchQuery}"`} />
      ) : displayItems.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No resources" description="Shared files will appear here" />
      ) : (
        <div className="space-y-3">
          {displayItems.map((item: any) => {
            const res = item.resource ?? item
            const type = res.type ?? item.type ?? 'other'
            return (
              <Card key={item.id || res.id} className={`${cardBg} flex items-center justify-between gap-3 p-4`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                    {getTypeIcon(type)}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{res.title ?? 'Resource'}</p>
                    {res.description && (
                      <p className={`mt-0.5 text-xs line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{res.description}</p>
                    )}
                    {item.student_name && (
                      <p className={`mt-0.5 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>For: {item.student_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDate(item.assigned_at ?? res.created_at)}</span>
                  {res.file_url && (
                    <a href={res.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  {!res.file_url && <ExternalLink className="h-4 w-4 text-slate-500" />}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Forms Tab ───────────────────────────────────────────────────────────────

function FormsTab({ familyId, studentIds }: { familyId: string; studentIds: string[] }) {
  const { isDark } = useTheme()
  const [forms, setForms] = useState<Form[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentIds.length === 0) { setLoading(false); return }
    Promise.all([
      db.from('forms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .then((r: { data: Form[] | null }) => r.data ?? []),
      db.from('form_submissions')
        .select('*')
        .eq('family_id', familyId)
        .order('submitted_at', { ascending: false })
        .then((r: { data: FormSubmission[] | null }) => r.data ?? []),
    ])
      .then(([f, s]) => { setForms(f); setSubmissions(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [familyId, studentIds])

  if (loading) return <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading…</p>

  const cardBg = isDark ? '!bg-slate-800/50 !border-slate-700/50' : ''
  const submittedIds = new Set(submissions.map((s) => s.form_id))

  return (
    <div>
      <PageHeader title="Forms" subtitle="Forms & questionnaires" />
      {forms.length === 0 && submissions.length === 0 ? (
        <EmptyState title="No forms" description="Assigned forms will appear here" />
      ) : (
        <div className="space-y-4">
          {/* available forms */}
          {forms.length > 0 && (
            <div>
              <h3 className={`mb-2 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Available Forms</h3>
              <div className="space-y-2">
                {forms.map((f) => {
                  const done = submittedIds.has(f.id)
                  return (
                    <Card key={f.id} className={`${cardBg} flex items-center justify-between gap-3 p-4`}>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{f.title}</p>
                        {f.description && (
                          <p className={`mt-0.5 text-xs line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{f.description}</p>
                        )}
                      </div>
                      <Badge variant={done ? 'green' : 'amber'}>
                        {done ? 'Submitted' : 'Pending'}
                      </Badge>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* past submissions */}
          {submissions.length > 0 && (
            <div>
              <h3 className={`mb-2 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Your Submissions</h3>
              <div className="space-y-2">
                {submissions.map((s) => (
                  <Card key={s.id} className={`${cardBg} p-4`}>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Submitted {fmtDate(s.submitted_at)}
                    </p>
                    <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {Object.entries(s.data).map(([k, v]) => (
                        <span key={k} className="mr-3">{k}: {String(v)}</span>
                      ))}
                    </div>
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
