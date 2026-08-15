// Floating AI assistant — launcher + chat panel. Hidden entirely when the
// "AI Assistant" setting is off (localStorage cadenza_ai_assistant_enabled).

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send } from 'lucide-react'
import { runAssistant, SUGGESTED_PROMPTS } from '../lib/assistant'

interface Msg {
  id: string
  role: 'user' | 'assistant'
  text: string
  sources?: string[]
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function AIAssistant() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('cadenza_ai_assistant_enabled') !== 'false')
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi! I'm your Cadenza assistant. I can look across your students, schedule, notes, invoices, practice, and library to help you run the studio — all locally. Try a suggestion below, or ask me to draft a message or summarize notes.",
    },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Live re-read when the Settings toggle changes
  useEffect(() => {
    const onToggle = () => setEnabled(localStorage.getItem('cadenza_ai_assistant_enabled') !== 'false')
    window.addEventListener('cadenza-ai-toggle', onToggle)
    return () => window.removeEventListener('cadenza-ai-toggle', onToggle)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, busy])

  const send = async (text?: string) => {
    const q = (text ?? input).trim()
    if (!q || busy) return
    setInput('')
    setMessages((m) => [...m, { id: uid(), role: 'user', text: q }])
    setBusy(true)
    try {
      const reply = await runAssistant(q)
      setMessages((m) => [...m, { id: uid(), role: 'assistant', text: reply.text, sources: reply.sources }])
    } catch {
      setMessages((m) => [...m, { id: uid(), role: 'assistant', text: "Sorry, I couldn't pull that up right now. Try again?" }])
    } finally {
      setBusy(false)
    }
  }

  if (!enabled) return null

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:to-indigo-700"
        title="Cadenza Assistant"
        aria-label="Cadenza Assistant"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-40 flex h-[30rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Cadenza Assistant</p>
              <p className="text-[10px] text-slate-400">Local · works on your data</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'}`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <p className="mt-1 text-[10px] opacity-60">Sources: {m.sources.join(', ')}</p>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-700">Thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-slate-700">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask or tell me to do something…"
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
