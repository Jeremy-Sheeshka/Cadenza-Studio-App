// Forms page — form builder and submissions management

import { useEffect, useState } from 'react'
import { db } from '../lib/api'
import type { Form as FormType, FormSubmission } from '../lib/types'
import { Card, PageHeader, Badge, Button, Input } from '../components/ui'

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
]

export default function Forms() {
  const [forms, setForms] = useState<FormType[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewSubmissions, setViewSubmissions] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      db.from('forms').select('*,form_submissions(count)').order('created_at', { ascending: false }),
      db.from('form_submissions').select('*').order('submitted_at', { ascending: false }),
    ]).then(([f, s]: any[]) => {
      setForms(f.data || [])
      setSubmissions(s.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const subCount = (formId: string) => submissions.filter((s) => s.form_id === formId).length

  return (
    <div>
      <PageHeader title="Forms" subtitle={`${forms.length} form${forms.length !== 1 ? 's' : ''}`} />
      <div className="mb-4">
        <Button onClick={() => setShowForm(true)}>New Form</Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : forms.length === 0 ? (
        <Card className="text-center py-8 px-4">
          <p className="text-sm text-slate-500">No forms yet</p>
          <p className="text-xs text-slate-400 mt-1">Create forms to collect information from families and students.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <Card key={f.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{f.title}</p>
                <p className="text-xs text-slate-400">
                  {f.description || 'No description'} · {f.fields?.length || 0} fields · {subCount(f.id)} submissions
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={f.is_active ? 'green' : 'slate'}>{f.is_active ? 'Active' : 'Inactive'}</Badge>
                <button
                  onClick={() => setViewSubmissions(f.id)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  View Submissions
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Form">
        <NewFormModal onSaved={() => {
          setShowForm(false)
          db.from('forms').select('*,form_submissions(count)').order('created_at', { ascending: false })
            .then((r: any) => setForms(r.data || []))
        }} />
      </Modal>

      {/* Submissions Modal */}
      <Modal open={!!viewSubmissions} onClose={() => setViewSubmissions(null)} title="Form Submissions">
        {viewSubmissions && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {submissions.filter((s) => s.form_id === viewSubmissions).length === 0 ? (
              <p className="text-sm text-slate-400">No submissions yet.</p>
            ) : (
              submissions.filter((s) => s.form_id === viewSubmissions).map((sub) => (
                <Card key={sub.id} className="text-sm p-4">
                  <p className="text-xs text-slate-400 mb-1">{new Date(sub.submitted_at).toLocaleDateString()}</p>
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 p-2 rounded">
                    {JSON.stringify(sub.data, null, 2)}
                  </pre>
                  {sub.payment_status && (
                    <Badge variant="amber">{sub.payment_status}</Badge>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function NewFormModal({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<{ id: string; type: string; label: string; required: boolean; options?: string }[]>([])
  const [saving, setSaving] = useState(false)

  const addField = () => {
    setFields([...fields, { id: crypto.randomUUID(), type: 'text', label: '', required: false }])
  }

  const updateField = (idx: number, patch: Partial<typeof fields[0]>) => {
    const next = [...fields]
    next[idx] = { ...next[idx], ...patch }
    setFields(next)
  }

  const removeField = (idx: number) => setFields(fields.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    const formFields = fields.map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      required: f.required,
      options: f.type === 'select' ? (f.options || '').split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    }))
    await db.from('forms').insert({
      title: title.trim(),
      description: description.trim() || null,
      fields: formFields,
      is_active: true,
      user_id: '56d5b457-8b27-43a2-8b21-74c88944759e',
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Student Information Form" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-600">Fields</label>
          <button onClick={addField} className="text-xs text-blue-700 hover:text-blue-800 font-medium">+ Add Field</button>
        </div>
        {fields.length === 0 && <p className="text-xs text-slate-400">No fields yet. Add some fields to your form.</p>}
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
              <div className="flex-1 space-y-1">
                <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Field label" />
                <div className="flex gap-2">
                  <Select value={f.type} onChange={(v) => updateField(i, { type: v })} options={FIELD_TYPE_OPTIONS} />
                  {f.type === 'select' && (
                    <Input value={f.options || ''} onChange={(e) => updateField(i, { options: e.target.value })} placeholder="Options (comma-separated)" />
                  )}
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                  Required
                </label>
              </div>
              <button onClick={() => removeField(i)} className="text-red-400 hover:text-red-600 text-sm mt-1">&times;</button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Create Form'}</Button>
      </div>
    </div>
  )
}
