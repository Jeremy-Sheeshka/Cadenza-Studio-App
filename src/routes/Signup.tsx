// /signup — role-aware signup page. Reads ?role= from URL.
// Teacher → auto-approved. Student/family → pending approval.

import { useState, type FormEvent } from 'react'
import { useAuth, type AccountType } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button, Input, Select } from '../components/ui'

type Role = 'teacher' | 'student' | 'family'

const roleConfig: Record<Role, { label: string; gradient: string; hover: string; accent: string }> = {
  teacher: {
    label: 'Teacher',
    gradient: 'from-blue-600 to-indigo-600',
    hover: 'hover:from-blue-700 hover:to-indigo-700',
    accent: 'text-blue-400',
  },
  student: {
    label: 'Student',
    gradient: 'from-purple-500 to-violet-600',
    hover: 'hover:from-purple-600 hover:to-violet-700',
    accent: 'text-purple-400',
  },
  family: {
    label: 'Parent',
    gradient: 'from-blue-500 to-indigo-600',
    hover: 'hover:from-blue-600 hover:to-indigo-700',
    accent: 'text-blue-400',
  },
}

const instrumentOptions = [
  { value: '', label: 'Select instrument' },
  { value: 'piano', label: 'Piano' },
  { value: 'guitar', label: 'Guitar' },
  { value: 'violin', label: 'Violin' },
  { value: 'voice', label: 'Voice' },
  { value: 'drums', label: 'Drums' },
  { value: 'cello', label: 'Cello' },
  { value: 'flute', label: 'Flute' },
  { value: 'clarinet', label: 'Clarinet' },
  { value: 'saxophone', label: 'Saxophone' },
  { value: 'trumpet', label: 'Trumpet' },
  { value: 'ukulele', label: 'Ukulele' },
  { value: 'bass', label: 'Bass' },
  { value: 'other', label: 'Other' },
]

const skillLevelOptions = [
  { value: '', label: 'Select skill level' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export default function Signup() {
  const [searchParams] = useSearchParams()
  const { isDark } = useTheme()
  const role = (searchParams.get('role') || 'teacher') as Role
  const cfg = roleConfig[role] ?? roleConfig.teacher

  // Common fields
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  // Teacher extra
  const [studioName, setStudioName] = useState('')

  // Student extra
  const [instrument, setInstrument] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [birthday, setBirthday] = useState('')
  const [goals, setGoals] = useState('')

  // Family extra
  const [studentNames, setStudentNames] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    let extra: any = {}
    if (role === 'teacher') {
      extra = { studio_name: studioName }
    } else if (role === 'student') {
      if (!instrument || !skillLevel) {
        setError('Please select your instrument and skill level')
        return
      }
      extra = { instrument, skill_level: skillLevel, birthday, goals }
    } else if (role === 'family') {
      extra = { student_names: studentNames }
    }

    setBusy(true)
    const result = await signUp(email, password, role as AccountType, displayName, extra)
    setBusy(false)

    if (result.error) { setError(result.error); return }
    if (result.pending) { setPending(true); return }
    navigate('/dashboard')
  }

  // Pending approval screen
  if (pending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-sm text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden">
            <img src="/branding/logo.png" alt="Cadenza Studio" className="h-full w-full object-contain" />
          </span>
          <h1 className="text-xl font-semibold text-white">Account Created</h1>
          <p className="mt-3 text-sm text-slate-400">
            Your account is pending approval from the studio teacher.
            You&apos;ll be able to sign in once approved.
          </p>
          <Link
            to="/app-login"
            className={`mt-6 inline-block text-sm font-medium ${cfg.accent} hover:underline`}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center px-4 py-16 transition-colors ${
      isDark ? 'bg-slate-900' : 'bg-slate-50'
    }`}>
      {/* Back to home */}
      <Link to="/" className={`absolute top-6 left-6 inline-flex items-center gap-1.5 text-xs transition-colors ${
        isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
      }`}>
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        Back
      </Link>

      <div className="w-full max-w-sm">
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden">
            <img src="/branding/logo.png" alt="Cadenza Studio" className="h-full w-full object-contain" />
          </span>
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Create your account</h1>
          <p className={`mt-1 text-sm font-medium ${cfg.accent}`}>
            Signing up as {cfg.label}
          </p>
        </div>

        <Card className="!p-6">
          {/* Role indicator */}
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-br ${cfg.gradient}`} />
            Signing up as {cfg.label}
          </div>

          {/* Signup form */}
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="text"
              required
              placeholder="Full name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              required
              placeholder="Password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              type="password"
              required
              placeholder="Confirm Password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            {/* Role-specific fields */}
            {role === 'teacher' && (
              <Input
                type="text"
                placeholder="Studio name (optional)"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
              />
            )}

            {role === 'student' && (
              <>
                <Select
                  required
                  options={instrumentOptions}
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                />
                <Select
                  required
                  options={skillLevelOptions}
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="Birthday"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
                <textarea
                  placeholder="Interests & goals (optional)"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </>
            )}

            {role === 'family' && (
              <textarea
                placeholder="Enter your children's names, one per line"
                value={studentNames}
                onChange={(e) => setStudentNames(e.target.value)}
                rows={3}
                className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
            )}

            <Button
              type="submit"
              disabled={busy}
              className={`w-full bg-gradient-to-r ${cfg.gradient} text-white shadow-sm ${cfg.hover}`}
            >
              {busy ? 'Creating account…' : 'Create Account'}
            </Button>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </form>

          {/* Sign-in link */}
          <p className="mt-4 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to={`/app-login?role=${role}`} className={`font-medium ${cfg.accent} hover:underline`}>
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
