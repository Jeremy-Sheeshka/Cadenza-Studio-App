// /auth/confirm — Supabase PKCE callback. Production detail: this route
// suppresses ALL analytics (Heap/GTM/Meta/PostHog) and sets referrer no-referrer,
// because the one-time code is in the query string. Kept as a pure stub here.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthConfirm() {
  const navigate = useNavigate()
  useEffect(() => {
    // Production: supabase.auth.exchangeCodeForSession(code) + cleanup of the URL.
    const t = setTimeout(() => navigate('/dashboard'), 1500)
    return () => clearTimeout(t)
  }, [navigate])
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-sm text-slate-300">
      Confirming your sign-in…
    </div>
  )
}
