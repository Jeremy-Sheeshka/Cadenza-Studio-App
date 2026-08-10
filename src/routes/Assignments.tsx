// /assignments — active & past assignments with stat cards, create modal, and grading UI.
// Mirrors the production tables: assignments, assignment_students, assignment_items.

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { db } from '../lib/api'
import type { Assignment, AssignmentStudent, AssignmentItem, Student } from '../lib/types'
import { Badge, Button, Card, EmptyState, Input, PageHeader } from '../components/ui'

const USER_ID = (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ?? '56d5b457-8b27-43a2-8b21-74c88944759e'

// ─── inline Select ──────────────────────────────────────────────────────────

function Select({
  value, onChange, children, className = '',
}: { value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; children: ReactNode; className?: string }) {
  return (
    <select value={value} onChange={onChange}
      className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
    >{children}</select>
  )
}

// ─── inline Modal ───────────────────────────────────────────────────────────

function Modal({
  open, onClose, title, children, size = 'md',
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  if (!open) return null
  const w = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-[10vh]">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${w} rounded-2xl border border-slate-200 bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  practice_goal: 'bg-blue-50 text-blue-700 ring-blue-200',
  theory: 'bg-purple-50 text-purple-700 ring-purple-200',
  listening: 'bg-green-50 text-green-700 ring-green-200',
  performance: 'bg-orange-50 text-orange-700 ring-orange-200',
  technique: 'bg-pink-50 text-pink-700 ring-pink-200',
}

const TYPE_LABEL: Record<string, string> = {
  practice_goal: 'Practice Goal',
  theory: 'Theory',
  listening: 'Listening',
  performance: 'Performance',
  technique: 'Technique',
}

function dueLabel(dueDate: string | null): { text: string; urgent: boolean } {
  if (!dueDate) return { text: 'No due date', urgent: false }
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - now.getTime()) / 86_400_000)
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgent: true }
  if (diff === 0) return { text: 'Today', urgent: true }
  if (diff === 1) return { text: 'Tomorrow', urgent: false }
  return { text: `${diff} days`, urgent: false }
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

// ─── /assignments ───────────────────────────────────────────────────────────

export default function Assignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<'active' | 'past'>('active')
  const [detail, setDetail] = useState<Assignment | null>(null)
  const [detailStudents, setDetailStudents] = useState<AssignmentStudent[]>([])
  const [detailItems, setDetailItems] = useState<AssignmentItem[]>([])

  // create modal
  const [showCreate, setShowCreate] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formType, setFormType] = useState('practice_goal')
  const [formDue, setFormDue] = useState('')
  const [formItems, setFormItems] = useState<string[]>([''])
  const [formStudentIds, setFormStudentIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // grading state
  const [grades, setGrades] = useState<Record<string, { grade: string; feedback: string; status: string }>>({})

  const refresh = () =>
    db.from('assignments')
      .select('*,assignment_students(*,student:students(first_name,last_name)),assignment_items(*)')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(100)
      .then((r: { data: Assignment[] }) => setAssignments(r.data ?? []))

  useEffect(() => {
    Promise.all([
      refresh(),
      db.from('students').select('id,first_name,last_name').eq('user_id', USER_ID).eq('status', 'active').order('last_name', { ascending: true }),
    ]).then(([, s]) => setStudents((s.data ?? []) as Student[]))
      .finally(() => setLoading(false))
  }, [])

  // classify active/past
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const active = assignments.filter((a) => {
    if (!a.due_date) return true
    return new Date(a.due_date) >= now
  })
  const past = assignments.filter((a) => {
    if (!a.due_date) return false
    return new Date(a.due_date) < now
  })
  const visible = tab === 'active' ? active : past

  // stats
  const stats = useMemo(() => {
    const as = (a: Assignment) => a.assignment_students ?? []
    return {
      active: active.length,
      pendingReview: active.reduce((c, a) => c + as(a).filter((s) => s.status === 'submitted').length, 0),
      graded: [...active, ...past].reduce((c, a) => c + as(a).filter((s) => s.status === 'graded').length, 0),
    }
  }, [active, past])

  // ── create ─────────────────────────────────────────────────────────────

  function openCreate() {
    setFormTitle(''); setFormDesc(''); setFormType('practice_goal'); setFormDue('')
    setFormItems(['']); setFormStudentIds([]); setShowCreate(true)
  }

  function addItem() { setFormItems((p) => [...p, '']) }
  function removeItem(i: number) { setFormItems((p) => p.filter((_, idx) => idx !== i)) }
  function setItem(i: number, v: string) { setFormItems((p) => p.map((x, idx) => idx === i ? v : x)) }

  function toggleStudent(id: string) {
    setFormStudentIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])
  }

  async function handleCreate() {
    setSaving(true)
    const now = new Date().toISOString()
    const assignId = crypto.randomUUID()

    await db.from('assignments').insert({
      id: assignId, user_id: USER_ID, created_at: now,
      title: formTitle || 'Untitled', description: formDesc || null,
      assignment_type: formType, due_date: formDue || null,
    })

    // insert checklist items
    for (let i = 0; i < formItems.length; i++) {
      const text = formItems[i].trim()
      if (!text) continue
      await db.from('assignment_items').insert({
        id: crypto.randomUUID(), assignment_id: assignId,
        title: text, target_count: 1, sort_order: i,
      })
    }

    // assign students
    for (const sid of formStudentIds) {
      await db.from('assignment_students').insert({
        id: crypto.randomUUID(), assignment_id: assignId, student_id: sid,
        status: 'assigned', grade: null, teacher_feedback: null,
        submission_text: null, submitted_at: null,
      })
    }

    await refresh()
    setSaving(false)
    setShowCreate(false)
  }

  // ── detail / grading ───────────────────────────────────────────────────

  function openDetail(a: Assignment) {
    setDetail(a)
    setDetailStudents(a.assignment_students ?? [])
    setDetailItems(a.assignment_items ?? [])
    const g: Record<string, { grade: string; feedback: string; status: string }> = {}
    for (const s of a.assignment_students ?? []) {
      g[s.student_id] = { grade: s.grade ?? '', feedback: s.teacher_feedback ?? '', status: s.status }
    }
    setGrades(g)
  }

  async function handleGrade(studentId: string) {
    const g = grades[studentId]
    if (!g) return
    const existing = detailStudents.find((s) => s.student_id === studentId)
    const newStatus = g.grade ? 'graded' : 'submitted'
    await db.from('assignment_students').update({
      grade: g.grade || null, teacher_feedback: g.feedback || null, status: newStatus,
    }).eq('id', existing?.id)
    // refresh the detail assignment
    const { data } = await db.from('assignments')
      .select('*,assignment_students(*,student:students(first_name,last_name)),assignment_items(*)')
      .eq('id', detail?.id).single()
    if (data) {
      setDetail(data as Assignment)
      setDetailStudents((data as Assignment).assignment_students ?? [])
      setDetailItems((data as Assignment).assignment_items ?? [])
      const g2: Record<string, { grade: string; feedback: string; status: string }> = {}
      for (const s of (data as Assignment).assignment_students ?? []) {
        g2[s.student_id] = { grade: s.grade ?? '', feedback: s.teacher_feedback ?? '', status: s.status }
      }
      setGrades(g2)
    }
    await refresh()
  }

  const studentName = (sid: string) => {
    const s = students.find((st) => st.id === sid); return s ? `${s.first_name} ${s.last_name}` : sid
  }

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader title="Assignments"
        subtitle={`${stats.active} active, ${stats.pendingReview} pending review, ${stats.graded} graded`}
        action={<Button onClick={openCreate} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">+ New Assignment</Button>}
      />

      {/* stat cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="text-center">
          <p className="text-3xl font-bold text-slate-900">{stats.active}</p>
          <p className="mt-1 text-xs text-slate-500">Active</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-amber-600">{stats.pendingReview}</p>
          <p className="mt-1 text-xs text-slate-500">Pending Review</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-indigo-600">{stats.graded}</p>
          <p className="mt-1 text-xs text-slate-500">Graded</p>
        </Card>
      </div>

      {/* tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {(['active', 'past'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t} <span className="ml-1 text-xs text-slate-400">({(t === 'active' ? active : past).length})</span></button>
        ))}
      </div>

      {loading ? <p className="text-sm text-slate-400">Loading\u2026</p>
      : visible.length === 0 ? (
        <EmptyState title={tab === 'active' ? 'No active assignments' : 'No past assignments'}
          description={tab === 'active' ? 'Create an assignment to get started' : 'Completed assignments will appear here'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((a) => {
            const as = a.assignment_students ?? []
            const items = a.assignment_items ?? []
            const dl = dueLabel(a.due_date)
            const submitted = as.filter((s) => s.status === 'submitted').length
            const graded = as.filter((s) => s.status === 'graded').length

            return (
              <button key={a.id} onClick={() => openDetail(a)} className="text-left">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900 text-sm">{a.title}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TYPE_COLORS[a.assignment_type] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                      {TYPE_LABEL[a.assignment_type] ?? a.assignment_type}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    {a.due_date && <span className={dl.urgent ? 'text-red-600 font-medium' : ''}>Due {dl.text}</span>}
                    <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    <span>{as.length} student{as.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    {submitted > 0 && <span className="text-amber-600 font-medium">{submitted} to review</span>}
                    {graded > 0 && <span className="text-indigo-600 font-medium">{graded} graded</span>}
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Create Modal ────────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Assignment" size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <Input placeholder="e.g. Week 12 Scales" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
              placeholder="Optional description\u2026" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
              <Select value={formType} onChange={(e) => setFormType(e.target.value)}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Due Date</label>
              <Input type="date" value={formDue} onChange={(e) => setFormDue(e.target.value)} />
            </div>
          </div>

          {/* Checklist items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Checklist Items</label>
              <button onClick={addItem} className="text-xs text-blue-700 hover:text-blue-800 font-medium">+ Add item</button>
            </div>
            <div className="space-y-2">
              {formItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder={`Item ${i + 1}`} value={item} onChange={(e) => setItem(i, e.target.value)} />
                  {formItems.length > 1 && (
                    <button onClick={() => removeItem(i)} className="shrink-0 rounded-full p-1 text-slate-400 hover:text-red-500 transition-colors">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Student multi-select */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Assigned Students</label>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-2">
              {students.length === 0 && <p className="text-xs text-slate-400 p-2">No students available</p>}
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={formStudentIds.includes(s.id)} onChange={() => toggleStudent(s.id)}
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-500" />
                  {s.first_name} {s.last_name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => setShowCreate(false)} className="bg-slate-100 text-slate-700">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !formTitle.trim()} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {saving ? 'Creating\u2026' : 'Create Assignment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Detail / Grading Modal ──────────────────────────────────────── */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? 'Assignment'} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TYPE_COLORS[detail.assignment_type] ?? ''}`}>
                {TYPE_LABEL[detail.assignment_type] ?? detail.assignment_type}
              </span>
              {detail.due_date && <span className="text-sm text-slate-500">Due {fmtDate(detail.due_date)}</span>}
            </div>
            {detail.description && <p className="text-sm text-slate-600">{detail.description}</p>}

            {/* checklist items */}
            {detailItems.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Checklist</p>
                <ul className="space-y-1">{detailItems.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-5 w-5 rounded border border-slate-300 flex items-center justify-center text-[10px] text-slate-400">{it.sort_order + 1}</span>
                    {it.title}
                  </li>
                ))}</ul>
              </div>
            )}

            {/* grading per student */}
            <div>
              <p className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Submissions ({detailStudents.length} student{detailStudents.length !== 1 ? 's' : ''})
              </p>
              {detailStudents.length === 0 ? (
                <p className="text-xs text-slate-400">No students assigned yet.</p>
              ) : (
                <div className="space-y-3">
                  {detailStudents.map((as) => {
                    const g = grades[as.student_id] ?? { grade: '', feedback: '', status: as.status }
                    return (
                      <div key={as.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm text-slate-900">{studentName(as.student_id)}</p>
                          <Badge variant={as.status === 'graded' ? 'green' : as.status === 'submitted' ? 'amber' : 'slate'}>
                            {as.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {as.submission_text && (
                          <p className="text-xs text-slate-600 mb-3 whitespace-pre-wrap bg-white rounded-lg p-2 border border-slate-100">
                            {as.submission_text}
                          </p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-500">Grade</label>
                            <Input placeholder="A, 95%, Pass, etc."
                              value={g.grade} onChange={(e) => setGrades((p) => ({ ...p, [as.student_id]: { ...p[as.student_id], grade: e.target.value, feedback: p[as.student_id]?.feedback ?? '', status: p[as.student_id]?.status ?? as.status } }))} />
                          </div>
                          <div className="flex items-end">
                            <Button onClick={() => handleGrade(as.student_id)}
                              className="w-full bg-indigo-600 text-white text-sm h-10">Save Grade</Button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="mb-1 block text-[11px] font-medium text-slate-500">Feedback</label>
                          <textarea className="h-16 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
                            placeholder="Teacher feedback\u2026"
                            value={g.feedback} onChange={(e) => setGrades((p) => ({ ...p, [as.student_id]: { ...p[as.student_id], grade: p[as.student_id]?.grade ?? '', feedback: e.target.value, status: p[as.student_id]?.status ?? as.status } }))} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button onClick={() => setDetail(null)} className="bg-slate-900 text-white">Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
