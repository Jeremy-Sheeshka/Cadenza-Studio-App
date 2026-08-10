// /app-login — role-aware login page. Reads ?role= from URL.
// Teacher → teal, Student → purple, Family → blue.

import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button, Input } from '../components/ui'

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
    gradient: 'from-blue-500 to-blue-700',
    hover: 'hover:from-blue-600 hover:to-blue-800',
    accent: 'text-blue-400',
  },
  family: {
    label: 'Parent',
    gradient: 'from-indigo-500 to-indigo-700',
    hover: 'hover:from-indigo-600 hover:to-indigo-800',
    accent: 'text-blue-400',
  },
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const { isDark } = useTheme()
  const role = (searchParams.get('role') || 'teacher') as Role
  const cfg = roleConfig[role] ?? roleConfig.teacher

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgotMsg, setForgotMsg] = useState<string | null>(null)
  const [forgotBusy, setForgotBusy] = useState(false)
  const { signIn, forgotPassword } = useAuth()
  const navigate = useNavigate()

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) { setError(error); return }

    // Route based on account type (server returns the user's actual role)
    const stored = localStorage.getItem('cadenza_token')
    if (stored) {
      try {
        const payload = JSON.parse(atob(stored.split('.')[1]))
        const at = payload.account_type || role
        if (at === 'teacher') navigate('/dashboard')
        else if (at === 'student') navigate('/student-portal')
        else if (at === 'family') navigate('/family-portal')
        else navigate('/dashboard')
      } catch {
        navigate('/dashboard')
      }
    } else {
      navigate('/dashboard')
    }
  }

  const onForgot = async () => {
    if (!email) {
      setForgotMsg('Please enter your email address first')
      return
    }
    setForgotBusy(true)
    setForgotMsg(null)
    try {
      await forgotPassword(email)
      setForgotMsg('If this account exists, a reset link has been sent.')
    } catch {
      setForgotMsg('If this account exists, a reset link has been sent.')
    } finally {
      setForgotBusy(false)
    }
  }

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center px-4 transition-colors ${
      isDark ? 'bg-slate-900' : 'bg-slate-50'
    }`}>
      {/* Back to home */}
      <Link to="/" className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        Back
      </Link>

      <div className="w-full max-w-sm">
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden">
            <img src="/branding/logo.png" alt="Cadenza Studio" className="h-full w-full object-contain" />
          </span>
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Welcome to Cadenza Studio</h1>
          <p className={`mt-1 text-sm font-medium ${cfg.accent}`}>
            Sign in as {cfg.label}
          </p>
        </div>

        <Card className="!p-6">
          {/* Role pill */}
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-br ${cfg.gradient}`} />
            Signing in as {cfg.label}
          </div>

          {/* Email + Password form */}
          <form onSubmit={onSignIn} className="space-y-3">
            <Input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? '👁' : '🔒'}
              </button>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className={`w-full bg-gradient-to-r ${cfg.gradient} text-white shadow-sm ${cfg.hover}`}
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </Button>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="text-center">
              <button
                type="button"
                onClick={onForgot}
                disabled={forgotBusy}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {forgotBusy ? 'Sending…' : 'Forgot password?'}
              </button>
              {forgotMsg && <p className="mt-1 text-xs text-blue-400">{forgotMsg}</p>}
            </div>
          </form>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3 text-xs text-slate-600">
            <span className="h-px flex-1 bg-slate-700" />
            or
            <span className="h-px flex-1 bg-slate-700" />
          </div>

          {/* OAuth placeholders — Coming Soon */}
          <div className="space-y-2">
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 h-10 text-sm font-medium text-slate-500 cursor-not-allowed"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-400">
                G
              </span>
              Continue with Google — Coming soon
            </button>
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-black h-10 text-sm font-medium text-slate-500 cursor-not-allowed"
            >
              <span className="text-lg leading-none"></span>
              Continue with Apple — Coming soon
            </button>
          </div>

          {/* Sign-up link */}
          <p className="mt-4 text-center text-xs text-slate-400">
            Don&apos;t have an account?{' '}
            <Link to={`/signup?role=${role}`} className={`font-medium ${cfg.accent} hover:underline`}>
              Sign up
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
