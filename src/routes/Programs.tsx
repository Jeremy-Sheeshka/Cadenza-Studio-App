// /programs — program management with enrollment tracking.

import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../lib/api'
import type { Program, ProgramEnrollment } from '../lib/types'
import { Card, PageHeader, Badge, Button, Input, EmptyState } from '../components/ui'

// ─── Local Modal ──────────────────────────────────────────────────────────────

function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

function fmtCurrency(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

const STATUS_TONE: Record<string, 'green' | 'amber' | 'slate' | 'red'> = {
  draft: 'slate',
  active: 'green',
  completed: 'amber',
}

const currentUserId = () =>
  (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ??
  '56d5b457-8b27-43a2-8b21-74c88944759e'

// ─── Main Programs Page ───────────────────────────────────────────────────────

export default function Programs() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [enrollments, setEnrollments] = useState<(ProgramEnrollment & { program?: Program | null; student?: { first_name: string; last_name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [showNew, setShowNew] = useState(false)

  // New program form state
  const [progName, setProgName] = useState('')
  const [progDescription, setProgDescription] = useState('')
  const [progStartDate, setProgStartDate] = useState('')
  const [progEndDate, setProgEndDate] = useState('')
  const [progStatus, setProgStatus] = useState<'draft' | 'active' | 'completed'>('draft')
  const [progPrice, setProgPrice] = useState('')

  useEffect(() => {
    Promise.all([
      db.from('programs').select('*').eq('user_id', currentUserId()).order('created_at', { ascending: false }),
      db.from('program_enrollments').select('*,program:programs(*),student:students(first_name,last_name)'),
    ]).then(([p, e]) => {
      setPrograms((p.data as Program[]) ?? [])
      setEnrollments((e.data as any[]) ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? programs.filter((p) => {
        const q = search.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
        )
      })
    : programs

  const enrollmentsFor = (programId: string) =>
    enrollments.filter((e) => e.program_id === programId)

  const handleCreate = async () => {
    if (!progName.trim()) return
    const { data } = await db.from('programs').insert({
      user_id: currentUserId(),
      name: progName,
      description: progDescription || null,
      start_date: progStartDate || null,
      end_date: progEndDate || null,
      status: progStatus,
      price: progPrice ? parseInt(progPrice, 10) : null,
      created_at: new Date().toISOString(),
    }).select('*').single()
    if (data) {
      setPrograms((prev) => [data as Program, ...prev])
    }
    setShowNew(false)
    setProgName(''); setProgDescription(''); setProgStartDate(''); setProgEndDate(''); setProgStatus('draft'); setProgPrice('')
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>

  return (
    <div>
      <PageHeader
        title="Programs"
        subtitle={`${programs.length} ${programs.length === 1 ? 'program' : 'programs'} total`}
        action={
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={() => setShowNew(true)}>
            + New Program
          </Button>
        }
      />

      <Input
        placeholder="Search programs…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />

      {filtered.length === 0 ? (
        <EmptyState title="No programs yet" description="Create a program to organize group classes, workshops, or recitals." />
      ) : selectedProgram ? (
        /* ─── Program detail: enrollments ────────────────────────────────── */
        <div className="space-y-6">
          <button
            onClick={() => setSelectedProgram(null)}
            className="text-sm text-blue-700 hover:text-blue-800 font-medium"
          >
            ← Back to all programs
          </button>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{selectedProgram.name}</h2>
                {selectedProgram.description && (
                  <p className="mt-1 text-sm text-slate-600">{selectedProgram.description}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <Badge variant={STATUS_TONE[selectedProgram.status] ?? 'slate'}>{selectedProgram.status}</Badge>
                  {selectedProgram.price != null && (
                    <span className="font-medium text-slate-700">{fmtCurrency(selectedProgram.price)}</span>
                  )}
                  <span>Start: {fmtDate(selectedProgram.start_date)}</span>
                  <span>End: {fmtDate(selectedProgram.end_date)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Enrollments */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              Enrollments ({enrollmentsFor(selectedProgram.id).length})
            </h3>
            {enrollmentsFor(selectedProgram.id).length === 0 ? (
              <p className="text-xs text-slate-400">No students enrolled yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Student</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Enrolled</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {enrollmentsFor(selectedProgram.id).map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-900 font-medium">
                          {e.student ? `${e.student.first_name} ${e.student.last_name}` : e.student_id ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{fmtDate(e.enrolled_at)}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={e.payment_status === 'paid' ? 'green' : e.payment_status === 'pending' ? 'amber' : 'slate'}>
                            {e.payment_status ?? '—'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* ─── Program card list ─────────────────────────────────────────── */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const count = enrollmentsFor(p.id).length
            return (
              <div key={p.id} onClick={() => setSelectedProgram(p)} className="cursor-pointer">
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <Badge variant={STATUS_TONE[p.status] ?? 'slate'}>{p.status}</Badge>
                  </div>
                  {p.description && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                    {p.start_date && <span>{fmtDate(p.start_date)}</span>}
                    {p.start_date && p.end_date && <span>→</span>}
                    {p.end_date && <span>{fmtDate(p.end_date)}</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {p.price != null && (
                      <span className="text-sm font-semibold text-slate-800">{fmtCurrency(p.price)}</span>
                    )}
                    <span className="text-xs text-slate-400">{count} {count === 1 ? 'enrollment' : 'enrollments'}</span>
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {/* New Program modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Program">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Program Name *</label>
            <Input value={progName} onChange={(e) => setProgName(e.target.value)} placeholder="e.g. Summer Workshop 2026" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <Input value={progDescription} onChange={(e) => setProgDescription(e.target.value)} placeholder="What this program is about…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <Input type="date" value={progStartDate} onChange={(e) => setProgStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <Input type="date" value={progEndDate} onChange={(e) => setProgEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={progStatus}
                onChange={(e) => setProgStatus(e.target.value as 'draft' | 'active' | 'completed')}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (cents)</label>
              <Input type="number" value={progPrice} onChange={(e) => setProgPrice(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={handleCreate}>Create Program</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
