// /messages — conversation list + chat thread

import { useEffect, useRef, useState } from 'react'
import { getConversations, db } from '../lib/api'
import { Badge, Button, Card, EmptyState, Input, PageHeader } from '../components/ui'
import type {
  BroadcastMessage, Conversation, ConversationMessage,
} from '../lib/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

const timeAgo = (iso: string | null) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' · '
    + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const statusBadge = (s: BroadcastMessage['delivery_status']) => {
  const map = { draft: 'slate' as const, sending: 'amber' as const, sent: 'green' as const }
  return <Badge variant={map[s]}>{s}</Badge>
}

// ─── /messages ───────────────────────────────────────────────────────────────

export function Messages() {
  const [convs, setConvs] = useState<(Conversation & { family?: { id: string; name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)

  // selected conversation
  const [selId, setSelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [msgText, setMsgText] = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)

  // broadcasts
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([])
  const [bcastOpen, setBcastOpen] = useState(false)
  const [bcastSubj, setBcastSubj] = useState('')
  const [bcastBody, setBcastBody] = useState('')

  // load conversations
  useEffect(() => {
    getConversations().then(setConvs).finally(() => setLoading(false))
  }, [])

  // load messages when conversation changes
  useEffect(() => {
    if (!selId) { setMessages([]); return }
    setMsgsLoading(true)
    db.from('conversation_messages')
      .select('*')
      .eq('conversation_id', selId)
      .order('created_at', { ascending: true })
      .then((res: { data: ConversationMessage[] }) => setMessages(res.data ?? []))
      .finally(() => setMsgsLoading(false))
  }, [selId])

  // load broadcasts
  useEffect(() => {
    db.from('broadcast_messages')
      .select('*')
      .eq('user_id', '56d5b457-8b27-43a2-8b21-74c88944759e')
      .eq('delivery_status', 'sent')
      .order('created_at', { ascending: false })
      .then((res: { data: BroadcastMessage[] }) => setBroadcasts(res.data ?? []))
  }, [])

  // auto-scroll on new messages
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const selConv = convs.find((c) => c.id === selId)
  const familyName = selConv?.family?.name ?? 'Unknown family'

  const handleSend = () => {
    const text = msgText.trim()
    if (!text || !selId) return
    const optimistic: ConversationMessage = {
      id: 'opt-' + Date.now(),
      conversation_id: selId,
      sender_type: 'teacher',
      body: text,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    setMessages((prev) => [...prev, optimistic])
    setMsgText('')
    // In production this would call an insert or RPC; we optimistically append only.
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <PageHeader title="Messages" subtitle="Conversations with families" />

      <div className="flex flex-1 gap-4 min-h-0">
        {/* ── left: conversation list ─────────────────────────────── */}
        <div className="w-80 shrink-0 flex flex-col gap-3 min-h-0">
          <Card className="flex-1 overflow-y-auto p-0 min-h-0">
            {loading ? (
              <p className="p-5 text-sm text-slate-400">Loading…</p>
            ) : convs.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No conversations" description="Messages with families will appear here." />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {convs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelId(c.id)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 ${
                      c.id === selId ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {c.family?.name ?? 'Unknown family'}
                      </p>
                      <span className="text-xs text-slate-400 shrink-0">
                        {timeAgo(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-400 truncate">
                        Family conversation thread
                      </p>
                      {c.teacher_unread_count > 0 && (
                        <Badge variant="destructive">{c.teacher_unread_count}</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* ── broadcast section (collapsible) ──────────────────── */}
          <div className="shrink-0">
            <button
              onClick={() => setBcastOpen(!bcastOpen)}
              className="flex w-full items-center justify-between rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <span>📢 Broadcasts</span>
              <span className={`text-xs transition-transform ${bcastOpen ? 'rotate-90' : ''}`}>▶</span>
            </button>

            {bcastOpen && (
              <Card className="mt-2 max-h-64 overflow-y-auto p-0">
                {/* new broadcast form */}
                <div className="border-b border-slate-100 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500">New Broadcast</p>
                  <Input
                    placeholder="Subject"
                    value={bcastSubj}
                    onChange={(e) => setBcastSubj(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <textarea
                    placeholder="Message body…"
                    value={bcastBody}
                    onChange={(e) => setBcastBody(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                  />
                  <Button
                    disabled={!bcastSubj.trim() || !bcastBody.trim()}
                    className="h-7 text-xs px-3 bg-blue-700 hover:bg-blue-800 text-white"
                  >
                    Send Broadcast
                  </Button>
                </div>

                {/* past broadcasts */}
                {broadcasts.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">
                    No broadcasts sent yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {broadcasts.map((b) => (
                      <div key={b.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-slate-800 truncate">{b.subject}</p>
                          {statusBadge(b.delivery_status)}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(b.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        {/* ── right: message thread ───────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {!selId ? (
            <Card className="flex-1 flex items-center justify-center">
              <EmptyState
                title="No conversation selected"
                description="Choose a conversation from the list to view messages."
              />
            </Card>
          ) : (
            <Card className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden">
              {/* header */}
              <div className="shrink-0 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <p className="text-sm font-semibold text-slate-900">{familyName}</p>
              </div>

              {/* messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {msgsLoading ? (
                  <p className="text-sm text-slate-400 text-center py-8">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <EmptyState title="No messages yet" description="Start the conversation by sending a message below." />
                  </div>
                ) : (
                  messages.map((m) => {
                    const isTeacher = m.sender_type === 'teacher'
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isTeacher ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] ${isTeacher ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              isTeacher
                                ? 'bg-blue-700 text-white rounded-br-md'
                                : 'bg-slate-100 text-slate-800 rounded-bl-md'
                            }`}
                          >
                            {m.body}
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1 px-1">
                            {fmtTime(m.created_at)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={msgEndRef} />
              </div>

              {/* input */}
              <div className="shrink-0 border-t border-slate-100 px-4 py-3 bg-white">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={`Message ${familyName}…`}
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!msgText.trim()}
                    className="bg-blue-700 hover:bg-blue-800 text-white shrink-0"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── /billing ────────────────────────────────────────────────────────────────
