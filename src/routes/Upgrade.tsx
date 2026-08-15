// /upgrade — plan comparison. Local self-hosted copies are already fully
// featured; the only premium add-on is network collaboration (multi-teacher /
// remote access).

import { useEffect, useState } from 'react'
import { getSubscription } from '../lib/api'
import type { Subscription } from '../lib/types'
import { Card, PageHeader, Badge, Button } from '../components/ui'
import { Check } from 'lucide-react'

const LOCAL_FEATURES = [
  'Unlimited students', 'Scheduling & calendar', 'Group lessons',
  'Attendance tracking', 'Direct messaging', 'Student portal with gamification',
  'Lesson notes & assignments', 'Practice logging', 'Auto-invoicing',
  'iCal/Google Calendar sync', 'Makeup credits', 'Unlimited broadcasts',
  'CSV & data export', '10 GB file storage', 'Local AI assistant',
]

const NETWORK_FEATURES = [
  'Invite other teachers', 'Shared studio access',
  'Remote login from anywhere', 'Shared billing & payroll',
  'Multi-location support', 'Priority support',
]

export default function Upgrade() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubscription().then((data) => {
      setSub(data as Subscription)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading…</div>

  const current = sub?.plan

  return (
    <div>
      <PageHeader
        title="Upgrade"
        subtitle="Your local copy already includes every feature. The only premium add-on is network collaboration."
      />

      <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
        {/* Local plan */}
        <Card className="ring-2 ring-blue-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-900">Studio (Local)</h3>
            <Badge variant="teal">Current</Badge>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">$0<span className="text-sm font-normal text-slate-400">/forever</span></p>
          <p className="text-xs text-slate-400 mb-4">Everything unlocked on your own machine</p>
          <ul className="space-y-2 mb-6">
            {LOCAL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full" disabled={current?.name === 'studio' || current?.name === 'free'}>
            Current plan
          </Button>
        </Card>

        {/* Network plan */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-900">Studio Network</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">$29<span className="text-sm font-normal text-slate-400">/month</span></p>
          <p className="text-xs text-slate-400 mb-4">Share your studio beyond your computer</p>
          <ul className="space-y-2 mb-6">
            {NETWORK_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700" disabled>
            Available in the hosted edition
          </Button>
        </Card>
      </div>
    </div>
  )
}
