// /students (+ /students/:slug) — list + detail matching app.trycadenzastudio.com.
// Queries students joined with families, plus schedules, notes, events,
// practice summaries, and assignments for the detail view.

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getStudents, db } from '../lib/api'
import type {
  Student, Family, LessonNote, CalendarEvent, WeeklyPracticeSummary,
  StudentSchedule, Assignment, StudentTagAssignment, EventStudent,
} from '../lib/types'

type StudentWithFamily = Omit<Student, 'family'> & { family?: Pick<Family, 'id' | 'name'> | null }
import { Card, PageHeader, Badge, Button, Input } from '../components/ui'
import { useFeatureGate } from '../lib/featureGate'

// ─── Local Select (mirrors Settings.tsx pattern) ────────────────────────────

function Select({
  className = '', ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
      {...props}
    />
  )
}

// ─── Local Modal (mirrors Settings.tsx pattern) ──────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  active: 'green',
  inactive: 'slate',
  prospective: 'amber',
  waitlist: 'slate',
  scheduled: 'green',
  attended: 'green',
  completed: 'green',
  cancelled: 'slate',
  no_show: 'red',
  late: 'amber',
  absent: 'red',
  draft: 'amber',
  published: 'green',
  in_progress: 'amber',
  assigned: 'slate',
  submitted: 'green',
  graded: 'green',
}

const SKILL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtCurrency(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

const currentUserId = () =>
  (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ??
  '56d5b457-8b27-43a2-8b21-74c88944759e'

// ─── Main Students List ─────────────────────────────────────────────────────

export default function Students() {
  const navigate = useNavigate()
  const { canUseFeature } = useFeatureGate()
  const atLimit = !canUseFeature('max_students')

  const [students, setStudents] = useState<StudentWithFamily[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Add form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [instrument, setInstrument] = useState('')
  const [skillLevel, setSkillLevel] = useState('beginner')
  const [lessonDuration, setLessonDuration] = useState('60')
  const [lessonPrice, setLessonPrice] = useState('')
  const [monthlyRate, setMonthlyRate] = useState('')
  const [status, setStatus] = useState('active')
  const [isAdult, setIsAdult] = useState(false)
  const [familyId, setFamilyId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      getStudents(),
      db.from('families').select('*,contacts(*)').eq('user_id', currentUserId()),
    ]).then(([s, f]) => {
      setStudents(s)
      setFamilies((f.data as Family[]) ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? students.filter((s) => {
        const q = search.toLowerCase()
        return (
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          (s.instrument ?? '').toLowerCase().includes(q) ||
          (s.email ?? '').toLowerCase().includes(q) ||
          (s.family?.name ?? '').toLowerCase().includes(q)
        )
      })
    : students

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      birthday: birthday || null,
      instrument: instrument.trim() || null,
      skill_level: skillLevel,
      lesson_duration: parseInt(lessonDuration, 10),
      lesson_price: lessonPrice ? parseInt(lessonPrice, 10) : 0,
      monthly_rate: monthlyRate ? parseInt(monthlyRate, 10) : null,
      status,
      is_adult: isAdult,
      family_id: familyId || null,
      notes: notes.trim() || null,
    }
    const { data, error } = await db.from('students').insert(payload).select('*').single()
    if (!error && data) {
      const family = familyId ? families.find((f) => f.id === familyId) : null
      const newStudent: StudentWithFamily = { ...data as Student, family: family ? { id: family.id, name: family.name } : null }
      setStudents((s) => [...s, newStudent])
      resetAddForm()
      setShowAdd(false)
    }
    setSaving(false)
  }

  const resetAddForm = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone('')
    setBirthday(''); setInstrument(''); setSkillLevel('beginner')
    setLessonDuration('60'); setLessonPrice(''); setMonthlyRate('')
    setStatus('active'); setIsAdult(false); setFamilyId(''); setNotes('')
  }

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${students.length} student${students.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => setShowImport(true)}
              className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Import Students
            </Button>
            <Button
              onClick={() => navigate('/families')}
              className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              New Family
            </Button>
            <Button
              onClick={() => setShowAdd(true)}
              disabled={atLimit}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              {atLimit ? 'Upgrade to add more' : '+ Add Student'}
            </Button>
          </div>
        }
      />

      {atLimit && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 ring-1 ring-amber-200">
          You've reached the student limit on your current plan.{' '}
          <Link to="/upgrade" className="font-medium underline">Upgrade</Link> to add more.
        </p>
      )}

      {/* Search */}
      <div className="mb-5">
        <Input
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
          <p className="text-sm font-medium text-slate-600">
            {search ? 'No students match your search' : 'No students yet'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {search ? 'Try a different search term' : 'Add your first student to start scheduling lessons'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link key={s.id} to={`/students/${s.id}`}>
              <Card className="transition-shadow hover:shadow-md h-full">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {s.first_name} {s.last_name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {s.instrument ?? 'Instrument TBD'}
                      {s.skill_level && (
                        <span className="ml-1.5">
                          <Badge variant="default">{SKILL_LABELS[s.skill_level] ?? s.skill_level}</Badge>
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge variant={STATUS_TONE[s.status] ?? 'slate'}>
                    {s.status}
                  </Badge>
                </div>

                {/* Lesson details */}
                <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-slate-500">
                  <span>Duration: {s.lesson_duration} min</span>
                  <span>Price: {fmtCurrency(s.lesson_price)}/lesson</span>
                  {s.monthly_rate != null && (
                    <span className="col-span-2">Monthly: {fmtCurrency(s.monthly_rate)}</span>
                  )}
                </div>

                {/* Gamification row */}
                <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  {s.practice_streak > 0 && (
                    <span>🔥 {s.practice_streak} day{s.practice_streak > 1 ? 's' : ''}</span>
                  )}
                  <span>Lvl {s.level}</span>
                  <span>{s.points.toLocaleString()} pts</span>
                  {s.makeup_credits > 0 && (
                    <span>{s.makeup_credits} makeup</span>
                  )}
                </div>

                {/* Family + tags */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-xs">
                  {s.family?.name && (
                    <span className="text-slate-500">{s.family.name}</span>
                  )}
                  {s.student_tags?.map((ta: StudentTagAssignment) => (
                    <Badge key={ta.tag_id} variant="default">
                      {ta.tag?.name ?? ta.tag_id}
                    </Badge>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Add Student Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetAddForm() }} title="Add Student">
        <form onSubmit={handleAdd} className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">First Name *</label>
              <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Last Name *</label>
              <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
              <Input placeholder="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Birthday</label>
            <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Instrument</label>
              <Input placeholder="e.g. Piano" value={instrument} onChange={(e) => setInstrument(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Skill Level</label>
              <Select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Lesson Duration</label>
              <Select value={lessonDuration} onChange={(e) => setLessonDuration(e.target.value)}>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Lesson Price (cents)</label>
              <Input placeholder="e.g. 4500" type="number" value={lessonPrice} onChange={(e) => setLessonPrice(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Monthly Rate (cents, optional)</label>
              <Input placeholder="e.g. 18000" type="number" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospective">Prospective</option>
                <option value="waitlist">Waitlist</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Family</label>
            <Select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
              <option value="">No family</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-600">
              <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} className="rounded" />
              Adult student
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
            <textarea
              className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
              placeholder="Any notes about this student..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => { setShowAdd(false); resetAddForm() }} className="flex-1 border border-slate-200 bg-white text-slate-700">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {saving ? 'Saving…' : 'Save Student'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Students">
        <p className="mb-4 text-sm text-slate-600">
          Upload a CSV file to bulk-import students. The expected columns are:
        </p>
        <ul className="mb-4 list-inside list-disc space-y-1 text-xs text-slate-500">
          <li>first_name (required)</li>
          <li>last_name (required)</li>
          <li>email</li>
          <li>phone</li>
          <li>instrument</li>
          <li>skill_level</li>
          <li>lesson_duration</li>
        </ul>
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="mt-1 text-xs text-slate-400">Drag a CSV file here or click to browse</p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setShowImport(false)} className="border border-slate-200 bg-white text-slate-700">
            Close
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Student Detail (/students/:slug) ──────────────────────────────────────

type DetailTab = 'overview' | 'schedule' | 'attendance' | 'notes' | 'practice' | 'assignments'

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'notes', label: 'Notes' },
  { key: 'practice', label: 'Practice' },
  { key: 'assignments', label: 'Assignments' },
]

export function StudentDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [student, setStudent] = useState<StudentWithFamily | null>(null)
  const [families, setFamilies] = useState<Family[]>([])
  const [schedules, setSchedules] = useState<StudentSchedule[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventStudents, setEventStudents] = useState<EventStudent[]>([])
  const [lessonNotes, setLessonNotes] = useState<LessonNote[]>([])
  const [practiceSummaries, setPracticeSummaries] = useState<WeeklyPracticeSummary[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Edit form state
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editBirthday, setEditBirthday] = useState('')
  const [editInstrument, setEditInstrument] = useState('')
  const [editSkillLevel, setEditSkillLevel] = useState('beginner')
  const [editLessonDuration, setEditLessonDuration] = useState('60')
  const [editLessonPrice, setEditLessonPrice] = useState('')
  const [editMonthlyRate, setEditMonthlyRate] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editIsAdult, setEditIsAdult] = useState(false)
  const [editFamilyId, setEditFamilyId] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editMakeupCredits, setEditMakeupCredits] = useState('0')
  const [editLevel, setEditLevel] = useState('0')
  const [editPoints, setEditPoints] = useState('0')

  // New schedule form
  const [newSchedDay, setNewSchedDay] = useState('1')
  const [newSchedTime, setNewSchedTime] = useState('15:00')
  const [newSchedDuration, setNewSchedDuration] = useState('60')

  useEffect(() => {
    if (!slug) return
    const uid = currentUserId()

    Promise.all([
      getStudents(),
      db.from('families').select('*,contacts(*)').eq('user_id', uid),
      db.from('student_schedules').select('*').eq('student_id', slug).eq('user_id', uid),
      db.from('events').select('*').eq('user_id', uid).eq('student_id', slug).order('start_time', { ascending: false }),
      db.from('event_students').select('*').eq('student_id', slug),
      db.from('lesson_notes').select('*').eq('user_id', uid).eq('student_id', slug).order('lesson_date', { ascending: false }),
      db.from('weekly_practice_summary').select('*').eq('student_id', slug),
      db.from('assignments').select('*,assignment_students!inner(*)').eq('user_id', uid),
    ]).then(([s, f, sch, ev, evs, ln, ps, as]) => {
      const found = (s as StudentWithFamily[]).find((st) => st.id === slug)
      if (found) setStudent(found)
      setFamilies((f.data as Family[]) ?? [])
      setSchedules((sch.data as StudentSchedule[]) ?? [])
      setEvents((ev.data as CalendarEvent[]) ?? [])
      setEventStudents((evs.data as EventStudent[]) ?? [])
      setLessonNotes((ln.data as LessonNote[]) ?? [])
      setPracticeSummaries((ps.data as WeeklyPracticeSummary[]) ?? [])
      // Filter assignments that have this student
      const rawAssignments = (as.data as (Assignment & { assignment_students?: { student_id: string }[] })[]) ?? []
      setAssignments(rawAssignments.filter((a) =>
        a.assignment_students?.some((ast) => ast.student_id === slug)
      ))
    }).finally(() => setLoading(false))
  }, [slug])

  // Populate edit form when student loads or editing starts
  useEffect(() => {
    if (!student) return
    setEditFirstName(student.first_name)
    setEditLastName(student.last_name)
    setEditEmail(student.email ?? '')
    setEditPhone(student.phone ?? '')
    setEditBirthday(student.birthday ?? '')
    setEditInstrument(student.instrument ?? '')
    setEditSkillLevel(student.skill_level ?? 'beginner')
    setEditLessonDuration(String(student.lesson_duration))
    setEditLessonPrice(String(student.lesson_price))
    setEditMonthlyRate(student.monthly_rate != null ? String(student.monthly_rate) : '')
    setEditStatus(student.status)
    setEditIsAdult(student.is_adult)
    setEditFamilyId(student.family_id ?? '')
    setEditNotes(student.notes ?? '')
    setEditMakeupCredits(String(student.makeup_credits))
    setEditLevel(String(student.level))
    setEditPoints(String(student.points))
  }, [student, editing])

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!student) return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
      <p className="text-sm font-medium text-slate-600">Student not found</p>
      <p className="mt-1 text-xs text-slate-400">
        <Link to="/students" className="text-blue-700 underline">Back to students list</Link>
      </p>
    </div>
  )

  const family = families.find((f) => f.id === student.family_id)

  const handleSave = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) return
    const patch: Record<string, unknown> = {
      first_name: editFirstName.trim(),
      last_name: editLastName.trim(),
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      birthday: editBirthday || null,
      instrument: editInstrument.trim() || null,
      skill_level: editSkillLevel,
      lesson_duration: parseInt(editLessonDuration, 10),
      lesson_price: editLessonPrice ? parseInt(editLessonPrice, 10) : 0,
      monthly_rate: editMonthlyRate ? parseInt(editMonthlyRate, 10) : null,
      status: editStatus,
      is_adult: editIsAdult,
      family_id: editFamilyId || null,
      notes: editNotes.trim() || null,
      makeup_credits: parseInt(editMakeupCredits, 10) || 0,
      level: parseInt(editLevel, 10) || 0,
      points: parseInt(editPoints, 10) || 0,
    }
    const { data, error } = await db.from('students').update(patch).eq('id', student.id).select('*').single()
    if (!error && data) {
      const updatedFamily = editFamilyId ? families.find((f) => f.id === editFamilyId) : null
      setStudent({
        ...data as Student,
        family: updatedFamily ? { id: updatedFamily.id, name: updatedFamily.name } : null,
      } as StudentWithFamily)
      setEditing(false)
    }
  }

  const handleDelete = async () => {
    await db.from('students').delete().eq('id', student.id)
    navigate('/students')
  }

  const handleAddSchedule = async (e: FormEvent) => {
    e.preventDefault()
    if (!slug) return
    const payload = {
      user_id: currentUserId(),
      student_id: slug,
      day_of_week: parseInt(newSchedDay, 10),
      start_time: newSchedTime,
      duration: parseInt(newSchedDuration, 10),
      effective_from: new Date().toISOString().slice(0, 10),
    }
    const { data } = await db.from('student_schedules').insert(payload).select('*').single()
    if (data) setSchedules((s) => [...s, data as StudentSchedule])
  }

  // Combine events directly on this student + events via event_students
  const studentEventIds = new Set(eventStudents.map((es) => es.event_id))
  const allEvents = events.filter((ev) => ev.student_id === student.id || studentEventIds.has(ev.id))
  // Deduplicate
  const seen = new Set<string>()
  const uniqueEvents = allEvents.filter((ev) => { const d = seen.has(ev.id); seen.add(ev.id); return !d })

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/students')}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to Students
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {student.first_name} {student.last_name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {student.instrument ?? 'No instrument'}{' '}
                {student.skill_level && (
                  <Badge variant="default">{SKILL_LABELS[student.skill_level] ?? student.skill_level}</Badge>
                )}
                {' '}
                <Badge variant={STATUS_TONE[student.status] ?? 'slate'}>{student.status}</Badge>
                {family && (
                  <span className="ml-2 text-slate-400">
                    · <Link to={`/families`} className="hover:text-blue-700">{family.name}</Link>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <Button onClick={() => setEditing(true)} className="border border-slate-200 bg-white text-slate-700">
                  Edit
                </Button>
                <Button onClick={() => setShowDeleteConfirm(true)} className="border border-red-200 bg-white text-red-600 hover:bg-red-50">
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditing(false)} className="border border-slate-200 bg-white text-slate-700">
                  Cancel
                </Button>
                <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Student">
        <p className="mb-2 text-sm text-slate-700">
          Are you sure you want to delete <strong>{student.first_name} {student.last_name}</strong>?
        </p>
        <p className="mb-4 text-xs text-slate-500">
          This action cannot be undone. All associated schedules, lesson notes, and event history will remain but become orphaned.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => setShowDeleteConfirm(false)} className="flex-1 border border-slate-200 bg-white text-slate-700">
            Cancel
          </Button>
          <Button onClick={handleDelete} className="flex-1 bg-red-600 text-white hover:bg-red-700">
            Delete
          </Button>
        </div>
      </Modal>

      {/* Tab Bar */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-500 text-blue-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <OverviewTab
          student={student}
          editing={editing}
          families={families}
          editFirstName={editFirstName} setEditFirstName={setEditFirstName}
          editLastName={editLastName} setEditLastName={setEditLastName}
          editEmail={editEmail} setEditEmail={setEditEmail}
          editPhone={editPhone} setEditPhone={setEditPhone}
          editBirthday={editBirthday} setEditBirthday={setEditBirthday}
          editInstrument={editInstrument} setEditInstrument={setEditInstrument}
          editSkillLevel={editSkillLevel} setEditSkillLevel={setEditSkillLevel}
          editLessonDuration={editLessonDuration} setEditLessonDuration={setEditLessonDuration}
          editLessonPrice={editLessonPrice} setEditLessonPrice={setEditLessonPrice}
          editMonthlyRate={editMonthlyRate} setEditMonthlyRate={setEditMonthlyRate}
          editStatus={editStatus} setEditStatus={setEditStatus}
          editIsAdult={editIsAdult} setEditIsAdult={setEditIsAdult}
          editFamilyId={editFamilyId} setEditFamilyId={setEditFamilyId}
          editNotes={editNotes} setEditNotes={setEditNotes}
          editMakeupCredits={editMakeupCredits} setEditMakeupCredits={setEditMakeupCredits}
          editLevel={editLevel} setEditLevel={setEditLevel}
          editPoints={editPoints} setEditPoints={setEditPoints}
        />
      )}
      {tab === 'schedule' && (
        <ScheduleTab
          schedules={schedules}
          newSchedDay={newSchedDay} setNewSchedDay={setNewSchedDay}
          newSchedTime={newSchedTime} setNewSchedTime={setNewSchedTime}
          newSchedDuration={newSchedDuration} setNewSchedDuration={setNewSchedDuration}
          onAddSchedule={handleAddSchedule}
        />
      )}
      {tab === 'attendance' && (
        <AttendanceTab events={uniqueEvents} eventStudents={eventStudents} studentId={student.id} />
      )}
      {tab === 'notes' && (
        <NotesTab lessonNotes={lessonNotes} />
      )}
      {tab === 'practice' && (
        <PracticeTab practiceSummaries={practiceSummaries} student={student} />
      )}
      {tab === 'assignments' && (
        <AssignmentsTab assignments={assignments} />
      )}
    </div>
  )
}

// ─── Tab: Overview ──────────────────────────────────────────────────────────

function OverviewTab({
  student, editing, families,
  editFirstName, setEditFirstName,
  editLastName, setEditLastName,
  editEmail, setEditEmail,
  editPhone, setEditPhone,
  editBirthday, setEditBirthday,
  editInstrument, setEditInstrument,
  editSkillLevel, setEditSkillLevel,
  editLessonDuration, setEditLessonDuration,
  editLessonPrice, setEditLessonPrice,
  editMonthlyRate, setEditMonthlyRate,
  editStatus, setEditStatus,
  editIsAdult, setEditIsAdult,
  editFamilyId, setEditFamilyId,
  editNotes, setEditNotes,
  editMakeupCredits, setEditMakeupCredits,
  editLevel, setEditLevel,
  editPoints, setEditPoints,
}: {
  student: StudentWithFamily
  editing: boolean
  families: Family[]
  editFirstName: string; setEditFirstName: (v: string) => void
  editLastName: string; setEditLastName: (v: string) => void
  editEmail: string; setEditEmail: (v: string) => void
  editPhone: string; setEditPhone: (v: string) => void
  editBirthday: string; setEditBirthday: (v: string) => void
  editInstrument: string; setEditInstrument: (v: string) => void
  editSkillLevel: string; setEditSkillLevel: (v: string) => void
  editLessonDuration: string; setEditLessonDuration: (v: string) => void
  editLessonPrice: string; setEditLessonPrice: (v: string) => void
  editMonthlyRate: string; setEditMonthlyRate: (v: string) => void
  editStatus: string; setEditStatus: (v: string) => void
  editIsAdult: boolean; setEditIsAdult: (v: boolean) => void
  editFamilyId: string; setEditFamilyId: (v: string) => void
  editNotes: string; setEditNotes: (v: string) => void
  editMakeupCredits: string; setEditMakeupCredits: (v: string) => void
  editLevel: string; setEditLevel: (v: string) => void
  editPoints: string; setEditPoints: (v: string) => void
}) {
  if (!editing) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Contact</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Email" v={student.email ?? '—'} />
            <Row k="Phone" v={student.phone ?? '—'} />
            <Row k="Birthday" v={fmtDate(student.birthday)} />
            <Row k="Adult" v={student.is_adult ? 'Yes' : 'No'} />
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Lesson Details</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Instrument" v={student.instrument ?? '—'} />
            <Row k="Skill Level" v={student.skill_level ? (SKILL_LABELS[student.skill_level] ?? student.skill_level) : '—'} />
            <Row k="Duration" v={`${student.lesson_duration} min`} />
            <Row k="Price per lesson" v={fmtCurrency(student.lesson_price)} />
            <Row k="Monthly rate" v={fmtCurrency(student.monthly_rate)} />
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Status & Credits</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Status" v={<Badge variant={STATUS_TONE[student.status] ?? 'slate'}>{student.status}</Badge>} />
            <Row k="Makeup credits" v={String(student.makeup_credits)} />
            <Row k="Family" v={student.family?.name ?? '—'} />
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Gamification</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Level" v={String(student.level)} />
            <Row k="Points" v={student.points.toLocaleString()} />
            <Row k="Practice streak" v={`🔥 ${student.practice_streak} day${student.practice_streak !== 1 ? 's' : ''}`} />
            <Row k="Longest streak" v={`${student.longest_practice_streak} day${student.longest_practice_streak !== 1 ? 's' : ''}`} />
            <Row k="Total practice" v={`${student.total_practice_minutes} min`} />
          </dl>
        </Card>
        {student.notes && (
          <Card className="md:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Notes</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{student.notes}</p>
          </Card>
        )}
      </div>
    )
  }

  // Editing mode
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-800">Edit Student</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">First Name *</label>
          <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Last Name *</label>
          <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
          <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
          <Input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Birthday</label>
          <Input type="date" value={editBirthday} onChange={(e) => setEditBirthday(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Instrument</label>
          <Input value={editInstrument} onChange={(e) => setEditInstrument(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Skill Level</label>
          <Select value={editSkillLevel} onChange={(e) => setEditSkillLevel(e.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Lesson Duration</label>
          <Select value={editLessonDuration} onChange={(e) => setEditLessonDuration(e.target.value)}>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Lesson Price (cents)</label>
          <Input type="number" value={editLessonPrice} onChange={(e) => setEditLessonPrice(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Monthly Rate (cents, optional)</label>
          <Input type="number" value={editMonthlyRate} onChange={(e) => setEditMonthlyRate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="prospective">Prospective</option>
            <option value="waitlist">Waitlist</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Family</label>
          <Select value={editFamilyId} onChange={(e) => setEditFamilyId(e.target.value)}>
            <option value="">No family</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Makeup Credits</label>
          <Input type="number" value={editMakeupCredits} onChange={(e) => setEditMakeupCredits(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Level</label>
          <Input type="number" value={editLevel} onChange={(e) => setEditLevel(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Points</label>
          <Input type="number" value={editPoints} onChange={(e) => setEditPoints(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={editIsAdult} onChange={(e) => setEditIsAdult(e.target.checked)} className="rounded" />
            Adult student
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
          <textarea
            className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
        </div>
      </div>
    </Card>
  )
}

// ─── Tab: Schedule ──────────────────────────────────────────────────────────

function ScheduleTab({
  schedules,
  newSchedDay, setNewSchedDay,
  newSchedTime, setNewSchedTime,
  newSchedDuration, setNewSchedDuration,
  onAddSchedule,
}: {
  schedules: StudentSchedule[]
  newSchedDay: string; setNewSchedDay: (v: string) => void
  newSchedTime: string; setNewSchedTime: (v: string) => void
  newSchedDuration: string; setNewSchedDuration: (v: string) => void
  onAddSchedule: (e: FormEvent) => void
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Current Weekly Schedule</h2>
        {schedules.length === 0 ? (
          <p className="text-xs text-slate-400">No recurring schedule slots yet.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((sch) => (
              <div key={sch.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">
                  {DAY_LABELS[sch.day_of_week]}
                </span>
                <span className="text-slate-500">
                  {sch.start_time} · {sch.duration} min
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Add Schedule Slot</h2>
        <form onSubmit={onAddSchedule} className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Day of Week</label>
            <Select value={newSchedDay} onChange={(e) => setNewSchedDay(e.target.value)}>
              {DAY_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Start Time</label>
            <Input type="time" value={newSchedTime} onChange={(e) => setNewSchedTime(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Duration</label>
            <Select value={newSchedDuration} onChange={(e) => setNewSchedDuration(e.target.value)}>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </Select>
          </div>
          <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            Add Slot
          </Button>
        </form>
      </Card>
    </div>
  )
}

// ─── Tab: Attendance ────────────────────────────────────────────────────────

function AttendanceTab({
  events,
  eventStudents,
  studentId,
}: {
  events: CalendarEvent[]
  eventStudents: EventStudent[]
  studentId: string
}) {
  const getAttendanceStatus = (ev: CalendarEvent): string => {
    const es = eventStudents.find((e) => e.event_id === ev.id && e.student_id === studentId)
    if (es) return es.attendance_status
    return ev.status
  }

  if (events.length === 0) {
    return (
      <Card>
        <p className="text-xs text-slate-400">No past events found for this student.</p>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Event History</h2>
      <div className="space-y-2">
        {events.map((ev) => {
          const att = getAttendanceStatus(ev)
          return (
            <div key={ev.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
              <div>
                <span className="font-medium text-slate-700">
                  {fmtDateShort(ev.start_time)}
                </span>
                <span className="ml-2 text-slate-400">
                  {fmtTime(ev.start_time)} – {fmtTime(ev.end_time)}
                </span>
                {ev.title && <span className="ml-2 text-slate-500">· {ev.title}</span>}
              </div>
              <Badge variant={STATUS_TONE[att] ?? 'slate'}>{att}</Badge>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Tab: Notes ─────────────────────────────────────────────────────────────

function NotesTab({ lessonNotes }: { lessonNotes: LessonNote[] }) {
  if (lessonNotes.length === 0) {
    return (
      <Card>
        <p className="text-xs text-slate-400">No lesson notes yet.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {lessonNotes.map((note) => (
        <Card key={note.id}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {note.lesson_date ? fmtDate(note.lesson_date) : 'No date'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {note.title ?? 'Untitled note'}
              </p>
            </div>
            <Badge variant={STATUS_TONE[note.status] ?? 'slate'}>{note.status}</Badge>
          </div>
          {note.body && (
            <div className="mt-2 text-sm text-slate-600 line-clamp-3">
              {note.body.content?.map((node: any, i: number) => (
                <span key={i}>
                  {node.content?.map((child: any) => child.text).join('') ?? ''}
                </span>
              )) ?? ''}
            </div>
          )}
          {note.private_notes && (
            <p className="mt-1 text-xs italic text-slate-400">
              Private: {note.private_notes.slice(0, 100)}{note.private_notes.length > 100 ? '…' : ''}
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}

// ─── Tab: Practice ──────────────────────────────────────────────────────────

function PracticeTab({
  practiceSummaries,
  student,
}: {
  practiceSummaries: WeeklyPracticeSummary[]
  student: StudentWithFamily
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Practice Stats</h2>
        <dl className="space-y-2 text-sm">
          <Row k="Current streak" v={`🔥 ${student.practice_streak} day${student.practice_streak !== 1 ? 's' : ''}`} />
          <Row k="Longest streak" v={`${student.longest_practice_streak} day${student.longest_practice_streak !== 1 ? 's' : ''}`} />
          <Row k="Total minutes" v={`${student.total_practice_minutes} min`} />
          <Row k="Level" v={String(student.level)} />
          <Row k="Points" v={student.points.toLocaleString()} />
        </dl>
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Weekly Summaries</h2>
        {practiceSummaries.length === 0 ? (
          <p className="text-xs text-slate-400">No practice data yet.</p>
        ) : (
          <div className="space-y-2">
            {practiceSummaries.map((ps, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">
                  {ps.days_practiced} day{ps.days_practiced !== 1 ? 's' : ''} · {ps.total_minutes} min
                </span>
                <Badge variant={ps.goal_met ? 'green' : 'amber'}>
                  {ps.goal_met ? 'Goal met' : 'Below goal'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Tab: Assignments ──────────────────────────────────────────────────────

function AssignmentsTab({ assignments }: { assignments: Assignment[] }) {
  if (assignments.length === 0) {
    return (
      <Card>
        <p className="text-xs text-slate-400">No assignments yet.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => {
        const studentAssign = a.assignment_students?.[0]
        return (
          <Card key={a.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                {a.description && (
                  <p className="mt-0.5 text-xs text-slate-500">{a.description}</p>
                )}
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                  <Badge variant="default">{a.assignment_type}</Badge>
                  {a.due_date && <span>Due: {fmtDate(a.due_date)}</span>}
                </div>
              </div>
              {studentAssign && (
                <Badge variant={STATUS_TONE[studentAssign.status] ?? 'slate'}>
                  {studentAssign.status}
                </Badge>
              )}
            </div>
            {a.assignment_items && a.assignment_items.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="text-xs font-medium text-slate-500 mb-1">Items:</p>
                <ul className="space-y-0.5">
                  {a.assignment_items.map((item) => (
                    <li key={item.id} className="text-xs text-slate-600">
                      {item.title} (×{item.target_count})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─── Shared Row helper ──────────────────────────────────────────────────────

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  )
}
