// /directory-leads — incoming inquiries from the teacher directory

import { useEffect, useState } from 'react'
import { db } from '../lib/api'
import type { DirectoryInquiry } from '../lib/types'
import { Card, PageHeader, Badge, Button, EmptyState } from '../components/ui'
import { Inbox, Mail, User } from 'lucide-react'

const STATUS_TONE: Record<string, 'green' | 'amber' | 'slate'> = {
  open: 'amber', invited: 'amber', contacted: 'green', archived: 'slate',
}

export default function DirectoryLeads() {
  const [inquiries, setInquiries] = useState<DirectoryInquiry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.rpc('get_my_directory_inquiries').then((r: any) => {
      setInquiries(r.data ?? [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Directory Leads" subtitle="Inquiries from your public teacher directory profile" />

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
      ) : inquiries.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No directory leads yet"
          description="When families find your profile in the teacher directory and reach out, their inquiries will appear here."
        />
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <Card key={inq.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-slate-400" />
                    <h3 className="font-medium text-sm text-slate-900">{inq.name}</h3>
                    <Badge variant={STATUS_TONE[inq.status] ?? 'slate'}>{inq.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${inq.email}`} className="text-blue-700 hover:underline">{inq.email}</a>
                  </div>
                  {inq.message && (
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mt-2">{inq.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">{new Date(inq.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => db.from('directory_inquiries').update({ status: 'contacted' }).eq('id', inq.id).then(() => {
                    setInquiries((prev) => prev.map((i) => i.id === inq.id ? { ...i, status: 'contacted' } : i))
                  })}>
                    Mark Contacted
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => db.from('directory_inquiries').update({ status: 'archived' }).eq('id', inq.id).then(() => {
                    setInquiries((prev) => prev.map((i) => i.id === inq.id ? { ...i, status: 'archived' } : i))
                  })}>
                    Archive
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
