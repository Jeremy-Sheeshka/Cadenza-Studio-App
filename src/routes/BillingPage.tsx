// /billing — invoices, payments, recurring templates, session passes, and settings.
// Mirrors the full billing surface observed in the production bundle.
import { useEffect, useState } from 'react'
import { getInvoices, getBillingSettings, db } from '../lib/api'
import type { Invoice, Payment, BillingSettings, RecurringInvoiceTemplate, SessionPass } from '../lib/types'
import { Card, PageHeader, Badge } from '../components/ui'

// ─── local api helpers (not yet exported from api.ts; use db directly) ────────

const currentUserId = () =>
  (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ??
  '56d5b457-8b27-43a2-8b21-74c88944759e'

async function getPayments() {
  const { data } = await db.from('payments')
    .select('*,invoice:invoices(invoice_number),family:families(id,name)')
    .eq('user_id', currentUserId())
    .order('payment_date', { ascending: false })
  return (data ?? []) as Payment[]
}

async function getRecurringTemplates() {
  const { data } = await db.from('recurring_invoice_templates')
    .select('*,family:families(id,name),recurring_invoice_line_items(*)')
    .eq('user_id', currentUserId())
    .order('created_at', { ascending: false })
  return (data ?? []) as RecurringInvoiceTemplate[]
}

async function getSessionPasses() {
  const { data } = await db.from('session_passes')
    .select('*,template:group_lesson_templates(id,group_name)')
    .eq('user_id', currentUserId())
    .order('purchased_at', { ascending: false })
  return (data ?? []) as SessionPass[]
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const fmtDate = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const statusBadge = (s: Invoice['status']) => {
  const map: Record<Invoice['status'], { label: string; tone: 'green' | 'amber' | 'red' | 'slate' }> = {
    draft: { label: 'Draft', tone: 'slate' },
    sent: { label: 'Sent', tone: 'amber' },
    partially_paid: { label: 'Partially Paid', tone: 'amber' },
    paid: { label: 'Paid', tone: 'green' },
    overdue: { label: 'Overdue', tone: 'red' },
    void: { label: 'Void', tone: 'slate' },
  }
  const m = map[s] ?? { label: s, tone: 'slate' as const }
  return <Badge variant={m.tone}>{m.label}</Badge>
}

const methodLabel = (m: string) => {
  const labels: Record<string, string> = {
    cash: 'Cash', check: 'Check', card: 'Card', bank_transfer: 'Bank Transfer',
    venmo: 'Venmo', paypal: 'PayPal', zelle: 'Zelle', other: 'Other',
  }
  return labels[m] ?? m
}

// ─── tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'invoices' | 'payments' | 'templates' | 'passes' | 'settings'

const tabs: { key: Tab; label: string }[] = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'templates', label: 'Recurring Templates' },
  { key: 'passes', label: 'Session Passes' },
  { key: 'settings', label: 'Settings' },
]

// ─── page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('invoices')

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [templates, setTemplates] = useState<RecurringInvoiceTemplate[]>([])
  const [passes, setPasses] = useState<SessionPass[]>([])
  const [settings, setSettings] = useState<BillingSettings | null>(null)

  const [loading, setLoading] = useState(true)

  // invoice detail modal
  const [detailInv, setDetailInv] = useState<Invoice | null>(null)

  useEffect(() => {
    Promise.all([
      getInvoices(),
      getPayments(),
      getRecurringTemplates(),
      getSessionPasses(),
      getBillingSettings(),
    ]).then(([inv, pay, tmpl, sp, bs]) => {
      setInvoices(inv)
      setPayments(pay)
      setTemplates(tmpl)
      setPasses(sp)
      setSettings(bs)
      setLoading(false)
    })
  }, [])

  // ─── outstanding total ──────────────────────────────────────────────────────

  const outstanding = invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft')
    .reduce((sum, i) => sum + i.balance_due, 0)

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Invoices, payments, recurring templates, session passes, and billing settings"
      />

      {/* Outstanding card */}
      <Card className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding Balance</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{fmt(outstanding)}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          {invoices.filter((i) => i.status === 'overdue').length} overdue
          {' · '}
          {invoices.filter((i) => i.status === 'sent' || i.status === 'partially_paid').length} open
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading billing data…</p>
      ) : (
        <>
          {tab === 'invoices' && (
            <InvoicesTab invoices={invoices} onDetail={setDetailInv} />
          )}
          {tab === 'payments' && <PaymentsTab payments={payments} />}
          {tab === 'templates' && <TemplatesTab templates={templates} />}
          {tab === 'passes' && <PassesTab passes={passes} />}
          {tab === 'settings' && <SettingsTab settings={settings} />}
        </>
      )}

      {/* Invoice detail modal */}
      {detailInv && (
        <InvoiceDetailModal
          invoice={detailInv}
          payments={payments.filter((p) => p.invoice_id === detailInv.id)}
          onClose={() => setDetailInv(null)}
        />
      )}
    </div>
  )
}

// ─── Invoices Tab ─────────────────────────────────────────────────────────────

function InvoicesTab({ invoices, onDetail }: { invoices: Invoice[]; onDetail: (inv: Invoice) => void }) {
  if (invoices.length === 0) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-400">No invoices yet.</p>
      </Card>
    )
  }

  return (
    <Card className="p-0">
      <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full text-left text-xs sm:text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Invoice #</th>
            <th className="px-5 py-3">Family</th>
            <th className="px-5 py-3">Issue Date</th>
            <th className="px-5 py-3">Due Date</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Total</th>
            <th className="px-5 py-3 text-right">Balance Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              onClick={() => onDetail(inv)}
              className="cursor-pointer transition-colors hover:bg-slate-50"
            >
              <td className="px-5 py-3 font-medium text-slate-900">{inv.invoice_number}</td>
              <td className="px-5 py-3 text-slate-600">{inv.family?.name ?? '—'}</td>
              <td className="px-5 py-3 text-slate-500">{fmtDate(inv.created_at)}</td>
              <td className="px-5 py-3 text-slate-500">{fmtDate(inv.due_date)}</td>
              <td className="px-5 py-3">{statusBadge(inv.status)}</td>
              <td className="px-5 py-3 text-right font-medium text-slate-800">{fmt(inv.total)}</td>
              <td className="px-5 py-3 text-right font-medium text-slate-800">{fmt(inv.balance_due)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>
  )
}

// ─── Invoice Detail Modal ─────────────────────────────────────────────────────

function InvoiceDetailModal({
  invoice,
  payments,
  onClose,
}: {
  invoice: Invoice
  payments: Payment[]
  onClose: () => void
}) {
  const items = invoice.invoice_line_items ?? []

  // Build a synthetic status history from timestamps
  const history: { label: string; date: string | null }[] = []
  history.push({ label: 'Created', date: invoice.created_at })
  if (invoice.sent_at) history.push({ label: 'Sent', date: invoice.sent_at })
  if (invoice.paid_at) history.push({ label: 'Paid in full', date: invoice.paid_at })
  else if (invoice.amount_paid > 0) history.push({ label: 'Partial payment received', date: null })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12 pb-12">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{invoice.invoice_number}</h2>
            <p className="text-sm text-slate-500">{invoice.family?.name ?? 'No family'}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-4 text-sm">
          <div>
            <span className="text-slate-400">Status: </span>
            {statusBadge(invoice.status)}
          </div>
          <div><span className="text-slate-400">Due: </span>{fmtDate(invoice.due_date)}</div>
          <div><span className="text-slate-400">Period: </span>
            {invoice.billing_period_start && invoice.billing_period_end
              ? `${fmtDate(invoice.billing_period_start)} – ${fmtDate(invoice.billing_period_end)}`
              : '—'}
          </div>
        </div>

        {/* Line items */}
        {items.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Line Items</h3>
            <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-400">
                <tr>
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Unit Price</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((li) => (
                  <tr key={li.id}>
                    <td className="py-2 text-slate-700">{li.description}</td>
                    <td className="py-2 text-right text-slate-600">{li.quantity}</td>
                    <td className="py-2 text-right text-slate-600">{fmt(li.unit_price)}</td>
                    <td className="py-2 text-right font-medium text-slate-800">{fmt(li.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="mt-2 space-y-1 text-right text-sm">
              <div className="text-slate-500">Subtotal: {fmt(invoice.subtotal)}</div>
              {invoice.tax > 0 && <div className="text-slate-500">Tax: {fmt(invoice.tax)}</div>}
              {invoice.discount > 0 && <div className="text-slate-500">Discount: −{fmt(invoice.discount)}</div>}
              <div className="font-semibold text-slate-900">Total: {fmt(invoice.total)}</div>
              <div className="text-slate-500">Paid: {fmt(invoice.amount_paid)}</div>
              <div className="font-semibold text-slate-900">Balance Due: {fmt(invoice.balance_due)}</div>
            </div>
          </div>
        )}

        {/* Payments applied */}
        {payments.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payments Applied</h3>
            <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-400">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium">Reference</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 text-slate-600">{fmtDate(p.payment_date)}</td>
                    <td className="py-2 text-slate-600">{methodLabel(p.payment_method)}</td>
                    <td className="py-2 text-slate-500">{p.reference_number ?? '—'}</td>
                    <td className="py-2 text-right font-medium text-slate-800">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* Status history */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status History</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className={`h-2 w-2 rounded-full ${i === history.length - 1 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                <span className="text-slate-700">{h.label}</span>
                {h.date && <span className="text-xs text-slate-400">{fmtDate(h.date)}</span>}
              </div>
            ))}
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <span className="font-medium">Notes: </span>{invoice.notes}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-400">No payments recorded yet.</p>
      </Card>
    )
  }

  return (
    <Card className="p-0">
      <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full text-left text-xs sm:text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Family</th>
            <th className="px-5 py-3 text-right">Amount</th>
            <th className="px-5 py-3">Method</th>
            <th className="px-5 py-3">Reference #</th>
            <th className="px-5 py-3">Invoice #</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-5 py-3 text-slate-600">{fmtDate(p.payment_date)}</td>
              <td className="px-5 py-3 text-slate-600">{p.family?.name ?? '—'}</td>
              <td className="px-5 py-3 text-right font-medium text-indigo-700">{fmt(p.amount)}</td>
              <td className="px-5 py-3 text-slate-600">{methodLabel(p.payment_method)}</td>
              <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.reference_number ?? '—'}</td>
              <td className="px-5 py-3 text-slate-600">{p.invoice?.invoice_number ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>
  )
}

// ─── Recurring Templates Tab ──────────────────────────────────────────────────

function TemplatesTab({ templates }: { templates: RecurringInvoiceTemplate[] }) {
  if (templates.length === 0) {
    return (
      <Card>
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-slate-600">No recurring invoice templates</p>
          <p className="mt-1 text-xs text-slate-400">Recurring templates let you auto-generate invoices on a schedule for regular students.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-0">
      <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full text-left text-xs sm:text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Title</th>
            <th className="px-5 py-3">Family</th>
            <th className="px-5 py-3">Frequency</th>
            <th className="px-5 py-3">Next Run</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Line Items</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {templates.map((t) => (
            <tr key={t.id}>
              <td className="px-5 py-3 font-medium text-slate-900">{t.title}</td>
              <td className="px-5 py-3 text-slate-600">{t.family?.name ?? '—'}</td>
              <td className="px-5 py-3 capitalize text-slate-600">{t.frequency}</td>
              <td className="px-5 py-3 text-slate-500">{fmtDate(t.next_run)}</td>
              <td className="px-5 py-3">
                <Badge variant={t.is_active ? 'green' : 'slate'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-5 py-3 text-right text-slate-600">
                {t.recurring_invoice_line_items?.length ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>
  )
}

// ─── Session Passes Tab ───────────────────────────────────────────────────────

function PassesTab({ passes }: { passes: SessionPass[] }) {
  if (passes.length === 0) {
    return (
      <Card>
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-slate-600">No session passes</p>
          <p className="mt-1 text-xs text-slate-400">Session passes let students pre-purchase a bundle of group class sessions at a discount.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-0">
      <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full text-left text-xs sm:text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Student</th>
            <th className="px-5 py-3">Template / Group</th>
            <th className="px-5 py-3 text-right">Total Sessions</th>
            <th className="px-5 py-3 text-right">Remaining</th>
            <th className="px-5 py-3">Purchased</th>
            <th className="px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {passes.map((sp) => (
            <tr key={sp.id}>
              <td className="px-5 py-3 text-slate-600">{sp.student_id}</td>
              <td className="px-5 py-3 text-slate-600">{sp.template?.group_name ?? '—'}</td>
              <td className="px-5 py-3 text-right font-medium text-slate-800">{sp.total_sessions}</td>
              <td className="px-5 py-3 text-right font-medium text-slate-800">{sp.remaining_sessions}</td>
              <td className="px-5 py-3 text-slate-500">{fmtDate(sp.purchased_at)}</td>
              <td className="px-5 py-3">
                <Badge variant={sp.is_active ? 'green' : 'slate'}>{sp.is_active ? 'Active' : 'Inactive'}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ settings }: { settings: BillingSettings | null }) {
  if (!settings) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-400">No billing settings configured.</p>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-800">Billing Settings</h2>
      <dl className="divide-y divide-slate-100 text-sm">
        <div className="flex justify-between py-3">
          <dt className="text-slate-500">Billing Model</dt>
          <dd className="font-medium capitalize text-slate-800">
            {settings.billing_model ? settings.billing_model.replace(/_/g, ' ') : 'Not set'}
          </dd>
        </div>
        <div className="flex justify-between py-3">
          <dt className="text-slate-500">Tax Rate</dt>
          <dd className="font-medium text-slate-800">{settings.tax_rate}%</dd>
        </div>
        <div className="flex justify-between py-3">
          <dt className="text-slate-500">Default Due Days</dt>
          <dd className="font-medium text-slate-800">{settings.default_due_days} days</dd>
        </div>
      </dl>
    </Card>
  )
}
