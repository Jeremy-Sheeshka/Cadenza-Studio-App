import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-center">
      <p className="text-5xl font-bold text-slate-200">404</p>
      <p className="mt-2 text-sm text-slate-500">
        Production note: the real app returns <code>200 + index.html</code> for missing routes
        (SPA fallback misconfig — see ARCHITECTURE.md finding #1).
      </p>
      <Link to="/" className="mt-6 text-sm font-medium text-blue-700 hover:underline">Back home</Link>
    </div>
  )
}
