// Feature gating — mirrors the production useFeatureGate hook: plan limits
// (max_students, storage_bytes, broadcasts_per_month) enforced client-side
// against usage. The real app also returns per-feature usage from the plan RPC;
// here we derive the same shape from the subscription payload.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSubscription } from './api'
import type { Subscription } from './types'

export type FeatureKey = 'billing' | 'ical_sync' | 'auto_invoicing' | 'makeup_credits' | 'stripe_payments' | 'broadcasts' | 'storage' | 'max_students'

interface Usage {
  used: number
  limit: number | null // null = unlimited
  canUse: boolean
  percentUsed: number
  remaining: number | null
}

interface GateValue {
  loading: boolean
  usage: Record<FeatureKey, Usage> | null
  canUseFeature: (k: FeatureKey) => boolean
}

const GateContext = createContext<GateValue | undefined>(undefined)

export function FeatureGateProvider({ children }: { children: ReactNode }) {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubscription()
      .then(setSub)
      .finally(() => setLoading(false))
  }, [])

  const usage = useGateUsage(sub)
  const value: GateValue = {
    loading,
    usage,
    canUseFeature: (k) => {
      const u = usage?.[k]
      return !!u?.canUse
    },
  }
  return <GateContext.Provider value={value}>{children}</GateContext.Provider>
}

export function useFeatureGate() {
  const ctx = useContext(GateContext)
  if (!ctx) throw new Error('useFeatureGate must be used within FeatureGateProvider')
  return ctx
}

function useGateUsage(sub: Subscription | null): Record<FeatureKey, Usage> | null {
  if (!sub) return null
  const limits = (sub.plan.limits ?? {}) as unknown as Record<string, unknown>
  const num = (k: string) => (typeof (limits as Record<string,unknown>)[k] === "number" ? ((limits as Record<string,unknown>)[k] as number) : null)
  const mk = (k: FeatureKey, used = 0): Usage => {
    const limit = num(k)
    const canUse = limit === null ? true : used < limit
    return {
      used, limit,
      canUse,
      percentUsed: limit === null ? 0 : limit === 0 ? 100 : (used / limit) * 100,
      remaining: limit === null ? null : Math.max(0, limit - used),
    }
  }
  return {
    billing: mk('billing', 0),
    ical_sync: mk('ical_sync', 0),
    auto_invoicing: mk('auto_invoicing', 0),
    makeup_credits: mk('makeup_credits', 0),
    stripe_payments: mk('stripe_payments', 0),
    broadcasts: mk('broadcasts', 0),
    storage: mk('storage', 0),
    max_students: mk('max_students', 3), // mock studio has 3 students
  }
}
