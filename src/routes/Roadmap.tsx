// /roadmap — public feature roadmap with voting.
// Production: roadmap_items / roadmap_suggestions / roadmap_votes are world-readable
// votes keyed by voter_identifier, one vote per item
// RPCs: cast_vote, remove_vote, submit_suggestion

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { db } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'
import type { RoadmapCategory, RoadmapItem, RoadmapSuggestion } from '../lib/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

const VOTER_KEY = 'cadenza_roadmap_voter_id'

function voterId(): string {
  let id = localStorage.getItem(VOTER_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VOTER_KEY, id)
  }
  return id
}

const CATEGORY_TW: Record<RoadmapCategory, string> = {
  scheduling: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  billing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  communication: 'bg-blue-50 text-blue-700 ring-blue-200',
  portal: 'bg-purple-50 text-purple-700 ring-purple-200',
  analytics: 'bg-red-50 text-red-700 ring-red-200',
  general: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const STATUS_COLS: { status: RoadmapItem['status']; label: string }[] = [
  { status: 'planned', label: 'Planned' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
]

// ─── component ───────────────────────────────────────────────────────────────

export default function Roadmap() {
  const { user, isTeacher: _isTeacher } = useAuth()
  const isAdmin = !!user && user.account_type === 'teacher'

  const [items, setItems] = useState<RoadmapItem[]>([])
  const [loading, setLoading] = useState(true)

  // votes the current voter has cast (set of item_id strings)
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())

  // suggestion modal
  const [showSuggest, setShowSuggest] = useState(false)
  const [sugType, setSugType] = useState<'feature' | 'bug'>('feature')
  const [sugTitle, setSugTitle] = useState('')
  const [sugDesc, setSugDesc] = useState('')
  const [sugEmail, setSugEmail] = useState('')
  const [sugBusy, setSugBusy] = useState(false)
  const [sugError, setSugError] = useState<string | null>(null)
  const [sugOk, setSugOk] = useState(false)

  // admin: pending suggestions
  const [suggestions, setSuggestions] = useState<RoadmapSuggestion[]>([])

  // admin: edit modal
  const [editing, setEditing] = useState<RoadmapItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCat, setEditCat] = useState<RoadmapCategory>('general')
  const [editStatus, setEditStatus] = useState<RoadmapItem['status']>('planned')
  const [editBusy, setEditBusy] = useState(false)

  // toast
  const [toast, setToast] = useState<string | null>(null)

  // ── fetch items ──────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await (db.from('roadmap_items')
        .select('*')
        .order('display_order', { ascending: true }) as Promise<{ data: RoadmapItem[] | null; error: unknown }>)
      setItems(data ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  // ── load my votes ────────────────────────────────────────────────────────

  useEffect(() => {
    const vid = voterId()
    db.from('roadmap_votes')
      .select('item_id')
      .eq('voter_identifier', vid)
      .then(({ data }: { data: { item_id: string }[] | null }) => {
        setMyVotes(new Set((data ?? []).map((r) => r.item_id)))
      })
      .catch(() => {})
  }, [])

  // ── load admin suggestions ───────────────────────────────────────────────

  const loadSuggestions = useCallback(async () => {
    if (!isAdmin) return
    try {
      const { data } = await (db.from('roadmap_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }) as Promise<{ data: RoadmapSuggestion[] | null; error: unknown }>)
      setSuggestions(data ?? [])
    } catch { /* ignore */ }
  }, [isAdmin])

  useEffect(() => { loadSuggestions() }, [loadSuggestions])

  // ── voting ───────────────────────────────────────────────────────────────

  const toggleVote = async (itemId: string) => {
    const vid = voterId()
    const voted = myVotes.has(itemId)
    // optimistic
    setMyVotes((prev) => {
      const next = new Set(prev)
      if (voted) next.delete(itemId); else next.add(itemId)
      return next
    })
    setItems((prev) =>
      prev.map((it) => it.id === itemId ? { ...it, vote_count: it.vote_count + (voted ? -1 : 1) } : it),
    )
    try {
      if (voted) {
        await db.rpc('remove_vote', { item_id: itemId, voter_identifier: vid })
      } else {
        await db.rpc('cast_vote', { item_id: itemId, voter_identifier: vid })
      }
    } catch {
      // revert on error
      setMyVotes((prev) => {
        const next = new Set(prev)
        if (voted) next.add(itemId); else next.delete(itemId)
        return next
      })
      setItems((prev) =>
        prev.map((it) => it.id === itemId ? { ...it, vote_count: it.vote_count + (voted ? 1 : -1) } : it),
      )
    }
  }

  // ── submit suggestion ────────────────────────────────────────────────────

  const onSubmitSuggestion = async (e: FormEvent) => {
    e.preventDefault()
    if (!sugTitle.trim() || !sugDesc.trim() || !sugEmail.trim()) {
      setSugError('All fields are required.')
      return
    }
    setSugBusy(true)
    setSugError(null)
    try {
      await db.rpc('submit_suggestion', {
        title: sugTitle.trim(),
        description: sugDesc.trim(),
        email: sugEmail.trim(),
        type: sugType,
        voter_identifier: voterId(),
      })
      setSugOk(true)
      setToast("Thanks! Your submission has been received.")
      setTimeout(() => { setShowSuggest(false); setSugOk(false); setSugTitle(''); setSugDesc(''); setSugEmail(''); setToast(null) }, 2000)
    } catch {
      setSugError('Something went wrong. Please try again.')
    }
    setSugBusy(false)
  }

  // ── admin: accept / dismiss suggestion ───────────────────────────────────

  const handleSuggestion = async (sug: RoadmapSuggestion, action: 'accepted' | 'declined') => {
    try {
      await db.from('roadmap_suggestions').update({ status: action }).eq('id', sug.id)
      setSuggestions((prev) => prev.filter((s) => s.id !== sug.id))
      if (action === 'accepted') {
        // promote to roadmap item
        const { data } = await db.from('roadmap_items').insert({
          title: sug.title,
          description: sug.description,
          category: 'general',
          status: 'planned',
          display_order: items.length + 1,
          vote_count: 0,
        }).select('*').single()
        if (data) setItems((prev) => [...prev, data as RoadmapItem])
      }
    } catch { /* ignore */ }
  }

  // ── admin: edit item ─────────────────────────────────────────────────────

  const openEdit = (item: RoadmapItem) => {
    setEditing(item)
    setEditTitle(item.title)
    setEditDesc(item.description ?? '')
    setEditCat(item.category)
    setEditStatus(item.status)
  }

  const saveEdit = async () => {
    if (!editing || !editTitle.trim()) return
    setEditBusy(true)
    try {
      await db.from('roadmap_items').update({
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        category: editCat,
        status: editStatus,
      }).eq('id', editing.id)
      setItems((prev) =>
        prev.map((it) => it.id === editing.id
          ? { ...it, title: editTitle.trim(), description: editDesc.trim() || null, category: editCat, status: editStatus }
          : it),
      )
      setEditing(null)
    } catch { /* ignore */ }
    setEditBusy(false)
  }

  const deleteItem = async (itemId: string) => {
    if (!confirm('Delete this item?')) return
    try {
      await db.from('roadmap_items').delete().eq('id', itemId)
      setItems((prev) => prev.filter((it) => it.id !== itemId))
    } catch { /* ignore */ }
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Public Roadmap"
          subtitle="What's next for Cadenza Studio"
          action={
            <Button
              onClick={() => setShowSuggest(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
            >
              Submit a Feature or Bug
            </Button>
          }
        />

        {/* toast */}
        {toast && (
          <div className="mb-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 ring-1 ring-indigo-200">
            {toast}
          </div>
        )}

        {/* admin: pending suggestions */}
        {isAdmin && suggestions.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Pending Suggestions ({suggestions.length})</h2>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <Card key={s.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{s.title}</span>
                      <Badge variant={s.type === 'bug' ? 'red' : 'slate'}>{s.type}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{s.description}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{s.email} · {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleSuggestion(s, 'accepted')}
                      className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleSuggestion(s, 'declined')}
                      className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Dismiss
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* three-column board */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {STATUS_COLS.map((col) => (
              <div key={col.status} className="rounded-2xl bg-slate-100 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-600">{col.label}</h3>
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Nothing here yet" description="Be the first to submit a suggestion!" />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {STATUS_COLS.map((col) => {
              const colItems = items.filter((i) => i.status === col.status)
              return (
                <div key={col.status} className="rounded-2xl bg-slate-100/80 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
                    {col.label}
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-500">{colItems.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {colItems.map((item) => {
                      const voted = myVotes.has(item.id)
                      return (
                        <Card key={item.id} className="group relative">
                          {/* admin controls */}
                          {isAdmin && (
                            <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEdit(item)}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-100"
                              >
                                Del
                              </button>
                            </div>
                          )}
                          <p className="text-sm font-medium text-slate-900 pr-14">{item.title}</p>
                          {item.description && (
                            <p className="mt-1 text-xs text-slate-500 line-clamp-3">{item.description}</p>
                          )}
                          <div className="mt-3 flex items-center justify-between">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${CATEGORY_TW[item.category]}`}>
                              {item.category}
                            </span>
                            <button
                              onClick={() => toggleVote(item.id)}
                              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                                voted
                                  ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`text-sm ${voted ? 'text-blue-700' : ''}`}>▲</span>
                              {item.vote_count}
                            </button>
                          </div>
                        </Card>
                      )
                    })}
                    {colItems.length === 0 && (
                      <p className="py-8 text-center text-xs text-slate-400">No items</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── suggestion modal ─────────────────────────────────────────────── */}

      {showSuggest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !sugBusy && setShowSuggest(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">
              {sugOk ? 'Submitted!' : 'Submit a Feature or Bug'}
            </h2>

            {sugOk ? (
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-600">Thanks! Your submission has been received.</p>
              </div>
            ) : (
              <form onSubmit={onSubmitSuggestion} className="mt-4 space-y-4">
                {/* type toggle */}
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
                  {(['feature', 'bug'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSugType(t)}
                      className={`rounded-lg py-2 capitalize transition-colors ${sugType === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      {t === 'feature' ? 'Feature Request' : 'Bug Report'}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                    placeholder="Short summary"
                    value={sugTitle}
                    onChange={(e) => setSugTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                  <textarea
                    className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                    required
                    placeholder="Tell us more…"
                    value={sugDesc}
                    onChange={(e) => setSugDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={sugEmail}
                    onChange={(e) => setSugEmail(e.target.value)}
                  />
                </div>

                {sugError && <p className="text-xs text-red-600">{sugError}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSuggest(false)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sugBusy}
                    className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {sugBusy ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── admin: edit modal ─────────────────────────────────────────────── */}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !editBusy && setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">Edit Item</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
                <input
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <textarea
                  className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                    value={editCat}
                    onChange={(e) => setEditCat(e.target.value as RoadmapCategory)}
                  >
                    {(Object.keys(CATEGORY_TW) as RoadmapCategory[]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as RoadmapItem['status'])}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editBusy}
                  onClick={saveEdit}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {editBusy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
