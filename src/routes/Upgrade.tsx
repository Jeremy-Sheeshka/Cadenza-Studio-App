// /upgrade — plan comparison page

import { useEffect, useState } from 'react'
import { getSubscription } from '../lib/api'
import type { Subscription } from '../lib/types'
import { Card, PageHeader, Badge, Button } from '../components/ui'
import { Check } from 'lucide-react'

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
      <PageHeader title="Upgrade" subtitle="Choose the plan that fits your studio" />

      <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
        {/* Free plan */}
        <Card className={current?.name === 'free' ? 'ring-2 ring-blue-500' : ''}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-900">Free</h3>
            {current?.name === 'free' && <Badge variant="teal">Current</Badge>}
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">$0<span className="text-sm font-normal text-slate-400">/month</span></p>
          <p className="text-xs text-slate-400 mb-4">Perfect for getting started</p>
          <ul className="space-y-2 mb-6">
            {['Up to 10 students', 'Scheduling & calendar', 'Group lessons', 'Basic attendance', 'Direct messaging', 'Student portal', 'Lesson notes & assignments', 'CSV export', '100 MB storage'].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full" disabled={current?.name === 'free'}>
            {current?.name === 'free' ? 'Current plan' : 'Downgrade'}
          </Button>
        </Card>

        {/* Pro plan */}
        <Card className={current?.name === 'pro' ? 'ring-2 ring-blue-500' : ''}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-900">Pro</h3>
            {current?.name === 'pro' && <Badge variant="teal">Current</Badge>}
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">$29<span className="text-sm font-normal text-slate-400">/month</span></p>
          <p className="text-xs text-slate-400 mb-4">Everything you need to run your studio</p>
          <ul className="space-y-2 mb-6">
            {['Unlimited students', 'Auto invoicing', 'Stripe payments', 'iCal sync', 'Makeup credits', '5 broadcasts/month', 'Priority support', '5 GB storage'].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <Check className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700" disabled={current?.name === 'pro'}>
            {current?.name === 'pro' ? 'Current plan' : 'Upgrade to Pro'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
