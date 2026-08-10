// AuthProvider — offline-first auth using the local Cadenza Studio API server.
// Three account types: teacher, student, family.

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react'
import { api } from './serverApi'

export type AccountType = 'teacher' | 'student' | 'family'

export interface AuthUser {
  id: string
  email: string
  display_name: string
  account_type: AccountType
}

interface AuthState {
  user: AuthUser | null
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, account_type: AccountType, display_name: string, extra?: any) => Promise<{ error?: string; pending?: boolean }>
  signOut: () => void
  forgotPassword: (email: string) => Promise<void>
  isTeacher: boolean
  isStudent: boolean
  isFamily: boolean
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  // On mount: try to restore session from stored token
  useEffect(() => {
    const token = localStorage.getItem('cadenza_token')
    if (!token) {
      setReady(true)
      return
    }
    api.me()
      .then((data) => {
        setUser({
          id: data.id,
          email: data.email,
          display_name: data.display_name,
          account_type: data.account_type,
        })
      })
      .catch(() => {
        localStorage.removeItem('cadenza_token')
      })
      .finally(() => setReady(true))
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const data = await api.login(email, password)
      localStorage.setItem('cadenza_token', data.token)
      setUser({
        id: data.user.id,
        email: data.user.email,
        display_name: data.user.display_name,
        account_type: data.user.account_type,
      })
      return {}
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch'
        ? 'Cannot reach the server. Is the backend running? Try: npm run dev:full'
        : err.message || 'Sign in failed'
      return { error: msg }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    account_type: AccountType,
    display_name: string,
    extra?: any,
  ): Promise<{ error?: string; pending?: boolean }> => {
    try {
      const data = await api.signup({ email, password, account_type, display_name, extra })
      // Teachers are auto-approved and get a token immediately
      if (account_type === 'teacher' && data.token) {
        localStorage.setItem('cadenza_token', data.token)
        setUser({
          id: data.user.id,
          email: data.user.email,
          display_name: data.user.display_name,
          account_type: data.user.account_type,
        })
        return {}
      }
      // Students and families need approval
      return { pending: true }
    } catch (err: any) {
      return { error: err.message || 'Sign up failed' }
    }
  }

  const signOut = () => {
    localStorage.removeItem('cadenza_token')
    setUser(null)
  }

  const forgotPassword = async (email: string) => {
    await api.forgotPassword(email)
  }

  const isTeacher = user?.account_type === 'teacher'
  const isStudent = user?.account_type === 'student'
  const isFamily = user?.account_type === 'family'

  const value = useMemo<AuthState>(() => ({
    user,
    signIn,
    signUp,
    signOut,
    forgotPassword,
    isTeacher,
    isStudent,
    isFamily,
  }), [user])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
