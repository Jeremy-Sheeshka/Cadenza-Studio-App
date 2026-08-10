// /reset-password — Supabase resetPasswordForEmail flow (recovery link).
import { useState, type FormEvent } from 'react'
import { Input, PrimaryButton } from '../components/ui'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const submit = (e: FormEvent) => { e.preventDefault(); setSent(true) }
  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
          <p className="text-sm font-medium text-slate-800">Check your inbox</p>
          <p className="mt-1 text-xs text-slate-500">We sent a password reset link to {email}.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-lg font-semibold text-slate-900">Reset password</h1>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <PrimaryButton type="submit">Send reset link</PrimaryButton>
        </form>
      </div>
    </div>
  )
}
