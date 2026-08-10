// / — public landing page with demo quick-access.

import { Link } from 'react-router-dom'
import { useState } from 'react'
import { GraduationCap, Music, Heart, Sparkles, Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

const DEMOS = [
  { role: 'teacher', email: 'teacher@cadenza.local', password: 'cadenza123', label: 'Demo Teacher', icon: GraduationCap },
  { role: 'student', email: 'student@cadenza.local', password: 'student123', label: 'Demo Student', icon: Music },
  { role: 'family',  email: 'family@cadenza.local',  password: 'family123',  label: 'Demo Parent',  icon: Heart },
] as const

const DEMO_REDIRECT: Record<string, string> = {
  teacher: '/dashboard',
  student: '/student-portal',
  family: '/family-portal',
}

const cards = [
  {
    role: 'teacher',
    icon: GraduationCap,
    title: "I'm a Teacher",
    description: 'Manage your studio — students, scheduling, billing, lesson notes, and AI-powered practice tracking.',
    color: 'blue',
  },
  {
    role: 'student',
    icon: Music,
    title: "I'm a Student",
    description: 'Access your practice portal, assignments, lesson summaries, and stay connected with your teacher.',
    color: 'indigo',
  },
  {
    role: 'family',
    icon: Heart,
    title: "I'm a Parent",
    description: 'Track your children\'s progress, manage schedules, communicate with the teacher, and handle billing.',
    color: 'sky',
  },
]

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  blue:    { bg: 'bg-blue-500/20',    border: 'hover:border-blue-500/50',    text: 'text-blue-400' },
  indigo:  { bg: 'bg-indigo-500/20',  border: 'hover:border-indigo-500/50',  text: 'text-indigo-400' },
  sky:     { bg: 'bg-sky-500/20',     border: 'hover:border-sky-500/50',     text: 'text-sky-400' },
}

export default function Landing() {
  const [demoBusy, setDemoBusy] = useState<string | null>(null)
  const { toggle, isDark } = useTheme()

  async function demoLogin(role: string, email: string, password: string) {
    setDemoBusy(role)
    try {
      const apiBase = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api'
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Server returned ${res.status}`)
      }
      const json = await res.json()
      localStorage.setItem('cadenza_token', json.data.token)
      if (role === 'family') {
        sessionStorage.setItem('cadenza_family_session', JSON.stringify({ token: json.data.token, ...json.data.user }))
      }
      if (role === 'student') {
        sessionStorage.setItem('cadenza_portal_access', JSON.stringify(json.data.user))
        sessionStorage.setItem('cadenza_portal_family', JSON.stringify(json.data.user))
      }
      // Force full reload so AuthProvider picks up the token on mount
      window.location.href = DEMO_REDIRECT[role] || '/dashboard'
    } catch (err: any) {
      // Show a clear error — don't silently dump the user on the login page
      const msg = err.message === 'Failed to fetch'
        ? 'Cannot reach the server. Make sure the backend is running:\n\n  cd ~/Projects/cadenza-studio/04-rebuild\n  npm run dev:full'
        : err.message || 'Something went wrong.'
      alert(`Demo login failed\n\n${msg}`)
    }
    setDemoBusy(null)
  }

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center px-4 py-16 transition-colors ${
      isDark
        ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
        : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'
    }`}>
      {/* Theme toggle */}
      <button onClick={toggle} className={`absolute top-6 right-6 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors ${
        isDark
          ? 'border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white hover:border-slate-500'
          : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-400 shadow-sm'
      }`}>
        {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        {isDark ? 'Light' : 'Dark'}
      </button>

      <div className="w-full max-w-3xl text-center">
        {/* Logo */}
        <div className="mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-2xl shadow-lg shadow-blue-500/20 overflow-hidden">
          <img src="/branding/logo.png" alt="Cadenza Studio" className="h-full w-full object-contain" />
        </div>

        {/* Headings */}
        <h1 className={`text-4xl font-bold md:text-5xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Welcome to Cadenza Studio
        </h1>
        <p className={`mt-3 text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Local Studio Management for Music Teachers
        </p>

        {/* Role cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {cards.map(({ role, icon: Icon, title, description, color }) => {
            const c = colorMap[color]
            return (
              <Link
                key={role}
                to={`/app-login?role=${role}`}
                className={`group rounded-2xl border bg-slate-800/50 dark:bg-slate-800/50 backdrop-blur p-6 text-left transition hover:-translate-y-1 ${
                  isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-white shadow-sm'
                } ${c.border}`}
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.bg}`}>
                  <Icon className={`h-5 w-5 ${c.text}`} />
                </div>
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {description}
                </p>
              </Link>
            )
          })}
        </div>

        {/* ── Demo quick-access ──────────────────────────────────────────── */}
        <div className={`mt-8 rounded-2xl border px-6 py-5 ${
          isDark ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-200 bg-blue-50/50'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className={`h-4 w-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <span className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Try the Demo</span>
            <Sparkles className={`h-4 w-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            No sign-up needed — explore all three views instantly with pre-loaded demo accounts.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {DEMOS.map(({ role, email, password, label, icon: Icon }) => (
              <button
                key={role}
                onClick={() => demoLogin(role, email, password)}
                disabled={demoBusy !== null}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 ${
                  isDark
                    ? 'border-slate-600 bg-slate-800/80 text-slate-200 hover:border-blue-500/50 hover:text-white hover:bg-slate-700/80'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                {demoBusy === role ? 'Signing in…' : label}
              </button>
            ))}
          </div>
        </div>

        {/* Sign-up links */}
        <div className="mt-8 text-sm text-slate-500">
          <span>Want your own account? </span>
          <Link to="/signup?role=teacher" className="text-blue-400 hover:underline">Sign up as Teacher</Link>
          <span className="mx-1.5 text-slate-600">·</span>
          <Link to="/signup?role=student" className="text-blue-400 hover:underline">Student</Link>
          <span className="mx-1.5 text-slate-600">·</span>
          <Link to="/signup?role=family" className="text-blue-400 hover:underline">Parent</Link>
        </div>
      </div>
    </div>
  )
}
