// /families — family management with detail view, contacts, students, invoices, and portal access.

import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../lib/api'
import type { Family, Contact, Student, Invoice, StudentPortalAccess } from '../lib/types'
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

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  active: 'green', inactive: 'slate', prospective: 'amber', waitlist: 'slate',
  paid: 'green', sent: 'amber', draft: 'slate',
  partially_paid: 'amber', overdue: 'red', void: 'slate',
}

const BILLING_LABELS: Record<string, string> = {
  per_lesson: 'Per Lesson',
  monthly: 'Monthly',
  term: 'Term',
}

const currentUserId = () =>
  (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ??
  '56d5b457-8b27-43a2-8b21-74c88944759e'

// ─── Main Families Page ───────────────────────────────────────────────────────

export default function Families() {
  const [families, setFamilies] = useState<Family[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [portalAccess, setPortalAccess] = useState<StudentPortalAccess[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(false)

  // Add form state
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addBillingMode, setAddBillingMode] = useState('per_lesson')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editBillingMode, setEditBillingMode] = useState('')

  useEffect(() => {
    Promise.all([
      db.from('families').select('*').eq('user_id', currentUserId()).order('name', { ascending: true }),
      db.from('contacts').select('*').eq('user_id', currentUserId()),
      db.from('students').select('id,first_name,last_name,family_id,status').eq('user_id', currentUserId()),
      db.from('invoices').select('*').eq('user_id', currentUserId()).order('created_at', { ascending: false }),
      db.from('student_portal_access').select('*'), // no user_id column — filtered client-side by family
    ]).then(([f, c, s, i, p]) => {
      setFamilies((f.data as Family[]) ?? [])
      setContacts((c.data as Contact[]) ?? [])
      setStudents((s.data as Student[]) ?? [])
      setInvoices((i.data as Invoice[]) ?? [])
      setPortalAccess((p.data as StudentPortalAccess[]) ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? families.filter((f) => {
        const q = search.toLowerCase()
        return (
          f.name.toLowerCase().includes(q) ||
          (f.email ?? '').toLowerCase().includes(q) ||
          (f.phone ?? '').toLowerCase().includes(q)
        )
      })
    : families

  const contactsForFamily = (familyId: string) => contacts.filter((c) => c.family_id === familyId)
  const studentsForFamily = (familyId: string) => students.filter((s) => s.family_id === familyId)
  const invoicesForFamily = (familyId: string) => invoices.filter((i) => i.family_id === familyId)
  const portalForFamily = (familyId: string) => portalAccess.find((p) => p.family_id === familyId)

  const handleAdd = async () => {
    if (!addName.trim()) return
    const { data } = await db.from('families').insert({
      user_id: currentUserId(),
      name: addName,
      email: addEmail || null,
      phone: addPhone || null,
      address: addAddress || null,
      notes: addNotes || null,
      billing_mode: addBillingMode,
      auto_pay_enabled: false,
      billing_frequency: 'monthly',
      stripe_customer_id: null,
    }).select('*').single()
    if (data) {
      setFamilies((prev) => [...prev, data as Family])
    }
    setShowAdd(false)
    setAddName(''); setAddEmail(''); setAddPhone(''); setAddAddress(''); setAddNotes(''); setAddBillingMode('per_lesson')
  }

  const handleEdit = async () => {
    if (!selectedFamily || !editName.trim()) return
    await db.from('families').update({
      name: editName,
      email: editEmail || null,
      phone: editPhone || null,
      address: editAddress || null,
      notes: editNotes || null,
      billing_mode: editBillingMode,
    }).eq('id', selectedFamily.id)
    setFamilies((prev) =>
      prev.map((f) =>
        f.id === selectedFamily.id
          ? { ...f, name: editName, email: editEmail || null, phone: editPhone || null, address: editAddress || null, notes: editNotes || null, billing_mode: editBillingMode }
          : f,
      ),
    )
    setSelectedFamily((prev) =>
      prev ? { ...prev, name: editName, email: editEmail || null, phone: editPhone || null, address: editAddress || null, notes: editNotes || null, billing_mode: editBillingMode } : null,
    )
    setEditing(false)
  }

  const openEdit = (f: Family) => {
    setEditName(f.name)
    setEditEmail(f.email ?? '')
    setEditPhone(f.phone ?? '')
    setEditAddress(f.address ?? '')
    setEditNotes(f.notes ?? '')
    setEditBillingMode(f.billing_mode ?? 'per_lesson')
    setEditing(true)
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>

  return (
    <div>
      <PageHeader
        title="Families"
        subtitle={`${families.length} ${families.length === 1 ? 'family' : 'families'} total`}
        action={
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={() => setShowAdd(true)}>
            + Add Family
          </Button>
        }
      />

      <Input
        placeholder="Search families…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />

      {/* Family list */}
      {filtered.length === 0 ? (
        <EmptyState title="No families yet" description="Add a family to start managing billing and communication." />
      ) : selectedFamily ? (
        /* ─── Detail view ──────────────────────────────────────────────── */
        <div className="space-y-6">
          <button
            onClick={() => { setSelectedFamily(null); setEditing(false) }}
            className="text-sm text-blue-700 hover:text-blue-800 font-medium"
          >
            ← Back to all families
          </button>

          {/* Family info card */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Billing Mode</label>
                        <select
                          value={editBillingMode}
                          onChange={(e) => setEditBillingMode(e.target.value)}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="per_lesson">Per Lesson</option>
                          <option value="monthly">Monthly</option>
                          <option value="term">Term</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                        <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                        <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                      <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                      <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button className="bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => setEditing(false)}>Cancel</Button>
                      <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={handleEdit}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold text-slate-900">{selectedFamily.name}</h2>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      {selectedFamily.email && <p>✉ {selectedFamily.email}</p>}
                      {selectedFamily.phone && <p>📞 {selectedFamily.phone}</p>}
                      {selectedFamily.address && <p>📍 {selectedFamily.address}</p>}
                      {selectedFamily.billing_mode && (
                        <p className="mt-1">
                          <Badge variant="default">{BILLING_LABELS[selectedFamily.billing_mode] ?? selectedFamily.billing_mode}</Badge>
                        </p>
                      )}
                      {selectedFamily.notes && (
                        <p className="mt-2 text-xs text-slate-400 italic">{selectedFamily.notes}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
              {!editing && (
                <Button className="bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => openEdit(selectedFamily)}>
                  Edit
                </Button>
              )}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contacts */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Contacts</h3>
              {contactsForFamily(selectedFamily.id).length === 0 ? (
                <p className="text-xs text-slate-400">No contacts added.</p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {contactsForFamily(selectedFamily.id).map((c) => (
                    <li key={c.id} className="py-2.5 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {c.first_name} {c.last_name}
                          {c.is_primary && <span className="ml-1.5 text-[10px] text-blue-700 font-medium">Primary</span>}
                        </p>
                        <p className="text-xs text-slate-500">{c.relationship ?? 'Contact'}</p>
                        {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                        {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Students */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Students</h3>
              {studentsForFamily(selectedFamily.id).length === 0 ? (
                <p className="text-xs text-slate-400">No students in this family.</p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {studentsForFamily(selectedFamily.id).map((s) => (
                    <li key={s.id} className="py-2.5 flex items-center justify-between">
                      <p className="text-sm text-slate-900">{s.first_name} {s.last_name}</p>
                      <Badge variant={STATUS_TONE[s.status] ?? 'slate'}>{s.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Invoices */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Invoices</h3>
            {invoicesForFamily(selectedFamily.id).length === 0 ? (
              <p className="text-xs text-slate-400">No invoices for this family.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Invoice</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Total</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Balance</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoicesForFamily(selectedFamily.id).map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-900 font-medium">{inv.invoice_number}</td>
                        <td className="px-4 py-2.5">{fmtCurrency(inv.total)}</td>
                        <td className="px-4 py-2.5">{fmtCurrency(inv.balance_due)}</td>
                        <td className="px-4 py-2.5"><Badge variant={STATUS_TONE[inv.status] ?? 'slate'}>{inv.status.replace('_', ' ')}</Badge></td>
                        <td className="px-4 py-2.5 text-slate-500">{fmtDate(inv.due_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Portal access */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Portal Access</h3>
            {(() => {
              const portal = portalForFamily(selectedFamily.id)
              if (!portal) return <p className="text-xs text-slate-400">No portal access configured.</p>
              return (
                <div className="space-y-1.5 text-sm">
                  <p className="text-slate-700">Email: <span className="text-slate-900">{portal.email ?? '—'}</span></p>
                  <p className="text-slate-700">
                    Last login: <span className="text-slate-900">{portal.last_login ? fmtDate(portal.last_login) : 'Never'}</span>
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={portal.lesson_emails_enabled ? 'green' : 'slate'}>
                      {portal.lesson_emails_enabled ? 'Lesson emails on' : 'Lesson emails off'}
                    </Badge>
                    {portal.must_change_password && <Badge variant="amber">Password change required</Badge>}
                  </div>
                </div>
              )
            })()}
          </Card>
        </div>
      ) : (
        /* ─── Card list ─────────────────────────────────────────────────── */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => {
            const studentCount = studentsForFamily(f.id).length
            const contacts = contactsForFamily(f.id)
            const primaryContact = contacts.find((c) => c.is_primary)
            return (
              <div key={f.id} onClick={() => setSelectedFamily(f)} className="cursor-pointer">
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-slate-900">{f.name}</h3>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {f.email && <p>{f.email}</p>}
                    {f.phone && <p>{f.phone}</p>}
                    <p className="text-slate-700 font-medium">{studentCount} {studentCount === 1 ? 'student' : 'students'}</p>
                    {f.billing_mode && (
                      <Badge variant="default">{BILLING_LABELS[f.billing_mode] ?? f.billing_mode}</Badge>
                    )}
                  </div>
                  {primaryContact && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Primary: {primaryContact.first_name} {primaryContact.last_name}
                    </p>
                  )}
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Family modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Family">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Family Name *</label>
            <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. The Smith Family" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <Input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="family@email.com" type="email" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <Input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="(555) 123-4567" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <Input value={addAddress} onChange={(e) => setAddAddress(e.target.value)} placeholder="123 Main St…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Any notes…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Billing Mode</label>
            <select
              value={addBillingMode}
              onChange={(e) => setAddBillingMode(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="per_lesson">Per Lesson</option>
              <option value="monthly">Monthly</option>
              <option value="term">Term</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white" onClick={handleAdd}>Add Family</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
