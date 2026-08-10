// /lesson-notes — draft & published lesson notes with editor/viewer modals
// Mirrors the production tables: lesson_notes, lesson_note_templates (see types.ts).

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { db } from '../lib/api'
import type { LessonNote, LessonNoteTemplate, Student, TipTapDoc } from '../lib/types'
import { Badge, Button, Card, EmptyState, Input, PageHeader } from '../components/ui'

const USER_ID = (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ?? '56d5b457-8b27-43a2-8b21-74c88944759e'

// ─── inline Select ──────────────────────────────────────────────────────────

function Select({
  value, onChange, children, className = '',
}: { value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; children: ReactNode; className?: string }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
    >
      {children}
    </select>
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

function extractText(doc: TipTapDoc | null | undefined, max = 200): string {
  if (!doc?.content) return ''
  const parts: string[] = []
  function walk(nodes: TipTapDoc['content']) {
    for (const n of nodes) {
      if (parts.length * 20 >= max) break
      if (n.text) parts.push(n.text)
      if (n.content) walk(n.content)
    }
  }
  walk(doc.content)
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim()
  return joined.length > max ? joined.slice(0, max) + '\u2026' : joined
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

const STATUS_BADGE: Record<string, 'green' | 'amber'> = { published: 'green', draft: 'amber' }

// ─── /lesson-notes ──────────────────────────────────────────────────────────

export default function LessonNotes() {
  const [notes, setNotes] = useState<(LessonNote & { student?: Pick<Student, 'first_name' | 'last_name'> | null })[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [templates, setTemplates] = useState<LessonNoteTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<'draft' | 'published'>('draft')
  const [viewing, setViewing] = useState<(typeof notes)[number] | null>(null)

  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formStudentId, setFormStudentId] = useState('')
  const [formLessonDate, setFormLessonDate] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formPrivateNotes, setFormPrivateNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [_noteResources, setNoteResources] = useState<Record<string, { title: string }[]>>({})

  const refresh = () =>
    db.from('lesson_notes')
      .select('*,student:students(first_name,last_name)')
      .eq('user_id', USER_ID)
      .order('updated_at', { ascending: false })
      .limit(100)
      .then((r: { data: (typeof notes)[number][] }) => setNotes(r.data ?? []))

  useEffect(() => {
    (async () => {
      // Load notes first so we have IDs for resource lookup
      const noteRes = await db.from('lesson_notes')
        .select('*,student:students(first_name,last_name)')
        .eq('user_id', USER_ID)
        .order('updated_at', { ascending: false })
        .limit(100)
      const loadedNotes = (noteRes.data ?? []) as LessonNote[]
      setNotes(loadedNotes)

      const [studRes, tmplRes] = await Promise.all([
        db.from('students').select('id,first_name,last_name').eq('user_id', USER_ID).eq('status', 'active').order('last_name', { ascending: true }),
        db.from('lesson_note_templates').select('*').eq('user_id', USER_ID).order('updated_at', { ascending: false }),
      ])
      setStudents((studRes.data ?? []) as Student[])
      setTemplates((tmplRes.data ?? []) as LessonNoteTemplate[])

      // Fetch resources for loaded notes
      const noteIds = loadedNotes.map((n) => n.id)
      if (noteIds.length > 0) {
        const { data: resData } = await db.from('lesson_note_resources')
          .select('lesson_note_id,resource:resources(title)')
          .in('lesson_note_id', noteIds)
        const byNote: Record<string, { title: string }[]> = {}
        for (const r of (resData ?? []) as { lesson_note_id: string; resource: { title: string } | null }[]) {
          if (r.resource) (byNote[r.lesson_note_id] ??= []).push(r.resource)
        }
        setNoteResources(byNote)
      }
      setLoading(false)
    })()
  }, [])

  const filtered = notes.filter((n) => n.status === tab)
  const counts = { draft: notes.filter((n) => n.status === 'draft').length, published: notes.filter((n) => n.status === 'published').length }

  function openNew() {
    setEditingId(null); setFormStudentId(''); setFormLessonDate(new Date().toISOString().slice(0, 10))
    setFormTitle(''); setFormBody(''); setFormPrivateNotes(''); setShowEditor(true)
  }

  function openView(note: (typeof notes)[number]) { setViewing(note) }

  function openEdit(note: (typeof notes)[number]) {
    setEditingId(note.id); setFormStudentId(note.student_id ?? '')
    setFormLessonDate(note.lesson_date?.slice(0, 10) ?? ''); setFormTitle(note.title ?? '')
    setFormBody(typeof note.body === 'string' ? note.body : JSON.stringify(note.body ?? '', null, 2))
    setFormPrivateNotes(note.private_notes ?? ''); setShowEditor(true)
  }

  async function handleSave(publish: boolean) {
    setSaving(true)
    const now = new Date().toISOString()
    const bodyDoc: TipTapDoc | null = formBody.trim()
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ text: formBody, type: 'text' }] }] }
      : null

    if (editingId) {
      await db.from('lesson_notes').update({
        student_id: formStudentId || null, title: formTitle || null,
        body: bodyDoc, private_notes: formPrivateNotes || null,
        status: publish ? 'published' : 'draft', lesson_date: formLessonDate || null,
        published_at: publish ? now : null, updated_at: now,
      }).eq('id', editingId)
    } else {
      await db.from('lesson_notes').insert({
        user_id: USER_ID, id: crypto.randomUUID(), created_at: now, updated_at: now,
        student_id: formStudentId || null, title: formTitle || null,
        body: bodyDoc, private_notes: formPrivateNotes || null,
        status: publish ? 'published' : 'draft', lesson_date: formLessonDate || null,
        published_at: publish ? now : null, emailed_at: null,
        fanout_group_id: null, target_student_ids: null,
      })
    }
    await refresh()
    setSaving(false)
    setShowEditor(false)
  }

  const studentName = (sid: string | null, emb?: { first_name?: string; last_name?: string } | null) => {
    if (emb?.first_name) return `${emb.first_name} ${emb.last_name ?? ''}`
    const s = students.find((st) => st.id === sid); return s ? `${s.first_name} ${s.last_name}` : 'No student'
  }

  return (
    <div>
      <PageHeader title="Lesson Notes" subtitle={`${notes.length} note${notes.length !== 1 ? 's' : ''}`}
        action={<Button onClick={openNew} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">+ New Note</Button>}
      />

      {/* tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {(['draft', 'published'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'draft' ? 'Draft Notes' : 'Published Notes'}
            <span className="ml-1.5 text-xs text-slate-400">({counts[t]})</span>
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-slate-400">Loading\u2026</p>
      : filtered.length === 0 ? (
        <EmptyState title={tab === 'draft' ? 'No draft notes' : 'No published notes'}
          description={tab === 'draft' ? 'Create a new note and save it as a draft' : 'Publish a draft note to see it here'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <button key={n.id} onClick={() => openView(n)} className="text-left">
              <Card className="transition-shadow hover:shadow-md h-full p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900 text-sm line-clamp-1">{n.title || 'Untitled'}</p>
                  <Badge variant={STATUS_BADGE[n.status] ?? 'slate'}>{n.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {studentName(n.student_id, n.student)}{n.lesson_date ? ` \u00b7 ${fmtDate(n.lesson_date)}` : ''}
                </p>
                <p className="mt-2 text-xs text-slate-400 line-clamp-3">{extractText(n.body)}</p>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* templates */}
      <div className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Lesson Note Templates</h2>
        {templates.length === 0
          ? <EmptyState title="No templates yet" description="Save a note as a template to reuse it later" />
          : <div className="grid gap-3 md:grid-cols-2">{templates.map((t) => (
              <Card key={t.id} className="p-4">
                <p className="font-medium text-slate-900 text-sm">{t.title}</p>
                <p className="mt-1 text-xs text-slate-400">{extractText(t.body)}</p>
              </Card>
            ))}</div>}
      </div>

      {/* view modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || 'Lesson Note'} size="lg">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={STATUS_BADGE[viewing.status] ?? 'slate'}>{viewing.status}</Badge>
              <span className="text-sm text-slate-500">{studentName(viewing.student_id, viewing.student)}</span>
              {viewing.lesson_date && <span className="text-sm text-slate-400">{fmtDate(viewing.lesson_date)}</span>}
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {typeof viewing.body === 'string' ? viewing.body : extractText(viewing.body, 10_000) || <span className="text-slate-400 italic">No content</span>}
            </div>
            {viewing.private_notes && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Private Notes</p>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900 whitespace-pre-wrap">{viewing.private_notes}</div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button onClick={() => { setViewing(null); openEdit(viewing) }} className="bg-slate-100 text-slate-700">Edit</Button>
              <Button onClick={() => setViewing(null)} className="bg-slate-900 text-white">Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* editor modal */}
      <Modal open={showEditor} onClose={() => setShowEditor(false)} title={editingId ? 'Edit Note' : 'New Note'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Student</label>
            <Select value={formStudentId} onChange={(e) => setFormStudentId(e.target.value)}>
              <option value="">No student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Lesson Date</label>
            <Input type="date" value={formLessonDate} onChange={(e) => setFormLessonDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <Input placeholder="e.g. Week 12 \u2014 Chopin Waltz" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Body</label>
            <textarea
              className="h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
              placeholder="Write your lesson notes here\u2026"
              value={formBody} onChange={(e) => setFormBody(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Private Notes</label>
            <textarea
              className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
              placeholder="Notes only visible to you\u2026"
              value={formPrivateNotes} onChange={(e) => setFormPrivateNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => handleSave(false)} disabled={saving} className="bg-slate-100 text-slate-700">
              {saving ? 'Saving\u2026' : 'Save as Draft'}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {saving ? 'Publishing\u2026' : 'Publish'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
