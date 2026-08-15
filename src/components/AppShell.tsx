// Teacher app shell — responsive sidebar with toggle at all screen sizes.
// Collapses automatically on wide-content pages (calendar) for more room.
// Layout: grouped nav sections, active edge indicator, ⌘K palette, account menu.

import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { useState, useEffect, type ReactNode } from 'react'
import {
  LayoutDashboard, CalendarDays, Users, MessageSquare, FileText,
  BookOpen, CreditCard, GraduationCap, RectangleEllipsis, Settings, LogOut, Inbox,
  Menu, X, ChevronLeft, ChevronRight, Search, ChevronDown, Sun, Moon,
  Plus, Bell, UserPlus, CalendarPlus, Megaphone,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { getSidebarCounts } from '../lib/api'
import { api } from '../lib/serverApi'
import AIAssistant from './AIAssistant'

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard }

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Studio',
    items: [
      { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
      { to: '/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    label: 'Teach',
    items: [
      { to: '/students', label: 'Students', icon: Users },
      { to: '/lesson-notes', label: 'Lesson Notes', icon: FileText },
      { to: '/programs', label: 'Programs', icon: GraduationCap },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/billing', label: 'Billing', icon: CreditCard },
      { to: '/forms', label: 'Forms', icon: RectangleEllipsis },
      { to: '/resources', label: 'Resources', icon: BookOpen },
      { to: '/directory-leads', label: 'Directory Leads', icon: Inbox },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

const NEW_ACTIONS = [
  { to: '/students', label: 'New Student', icon: UserPlus },
  { to: '/calendar', label: 'New Event', icon: CalendarPlus },
  { to: '/lesson-notes', label: 'New Lesson Note', icon: FileText },
  { to: '/billing', label: 'New Invoice', icon: CreditCard },
  { to: '/messages', label: 'Send Broadcast', icon: Megaphone },
]

function getBreadcrumb(pathname: string): { group: string; label: string } {
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (pathname === item.to || pathname.startsWith(item.to + '/')) {
        return { group: g.label, label: item.label }
      }
    }
  }
  const seg = pathname.split('/').filter(Boolean)[0] ?? ''
  const label = seg
    ? seg.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Home'
  return { group: 'Cadenza', label }
}

// Pages that need full width — sidebar defaults to collapsed here
const WIDE_PAGES = ['/calendar']

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white ${className ?? 'h-8 w-8 text-xs'}`}>
      {(name || '??').slice(0, 2).toUpperCase()}
    </span>
  )
}

function NotificationRow({ to, icon, label, count, onClick }: {
  to: string
  icon: ReactNode
  label: string
  count: number
  onClick?: () => void
}) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">{icon}</span>
      <span className="flex-1 text-slate-700 dark:text-slate-200">{label}</span>
      {count > 0 ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{count}</span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-500">0</span>
      )}
    </Link>
  )
}

function SidebarContent({ onClick, collapsed, onOpenSearch, counts }: {
  onClick?: () => void
  collapsed?: boolean
  onOpenSearch?: () => void
  counts: { unreadCount: number; todayLessonCount: number }
}) {
  const { user, signOut } = useAuth()
  const { toggle, isDark } = useTheme()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const badgeFor = (to: string): number => {
    if (to === '/messages') return counts.unreadCount
    if (to === '/calendar') return counts.todayLessonCount
    return 0
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 gap-3">
        <button
          onClick={onOpenSearch}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          title="Search (⌘K)"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <nav className="flex-1 w-full overflow-y-auto px-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="my-2 h-px bg-slate-100 dark:bg-slate-700" />}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClick}
                    aria-label={label}
                    className={({ isActive }) =>
                      `group relative flex items-center justify-center rounded-xl p-2 transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-800 dark:bg-slate-700 dark:text-white'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-blue-600" />
                        )}
                        <Icon className="h-4 w-4 shrink-0" />
                        {badgeFor(to) > 0 && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800" />
                        )}
                        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          {label}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <button
          onClick={() => { void signOut(); navigate('/app-login') }}
          className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 dark:border-slate-700 px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden shrink-0">
          <img src="/branding/logo.png" alt="Cadenza Studio" className="h-full w-full object-contain" />
        </span>
        <span className="flex-1 text-sm font-semibold dark:text-white">Cadenza Studio</span>
        <button
          onClick={onOpenSearch}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          title="Search (⌘K)"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClick}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-800 dark:bg-slate-700 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-blue-600" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                      {badgeFor(to) > 0 && (
                        <span className={`ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-4 ${to === '/messages' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                          {badgeFor(to)}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="relative border-t border-slate-100 dark:border-slate-700 p-3">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <Avatar name={user?.display_name ?? user?.email ?? '??'} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium dark:text-white">{user?.display_name ?? user?.email}</span>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">{user?.account_type ?? ''}</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-3 right-3 z-50 mb-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings') }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button
                onClick={() => { setMenuOpen(false); toggle() }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
              <button
                onClick={() => { setMenuOpen(false); void signOut(); navigate('/app-login') }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)

  const results = ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (open) { setQuery(''); setSelected(0) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter' && results[selected]) { navigate(results[selected].to); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, selected, navigate, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 dark:border-slate-700">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search pages…"
            className="h-12 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-600">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">No pages found</p>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  key={item.to}
                  onClick={() => { navigate(item.to); onClose() }}
                  onMouseEnter={() => setSelected(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-left ${
                    i === selected
                      ? 'bg-blue-50 text-blue-800 dark:bg-slate-700 dark:text-white'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {i === selected && <span className="text-[10px] text-slate-400">↵</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function AppShell() {
  const location = useLocation()
  const isWidePage = WIDE_PAGES.some((p) => location.pathname.startsWith(p))
  const [collapsed, setCollapsed] = useState(isWidePage)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [counts, setCounts] = useState({ unreadCount: 0, todayLessonCount: 0, overdueInvoiceCount: 0 })
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])

  useEffect(() => {
    setCollapsed(isWidePage)
  }, [isWidePage])

  useEffect(() => {
    let active = true
    getSidebarCounts()
      .then((c) => { if (active) setCounts(c) })
      .catch(() => {})
    return () => { active = false }
  }, [location.pathname])

  useEffect(() => {
    api.pendingApprovals()
      .then((data) => setPendingApprovals(Array.isArray(data) ? data : []))
      .catch(() => setPendingApprovals([]))
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const crumb = getBreadcrumb(location.pathname)
  const totalNotifications = counts.unreadCount + counts.overdueInvoiceCount + pendingApprovals.length

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Desktop collapsed mini-sidebar */}
      {collapsed && (
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-20 w-14 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center h-12 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <SidebarContent collapsed onOpenSearch={() => setPaletteOpen(true)} counts={counts} />
        </aside>
      )}

      {/* Desktop expanded sidebar */}
      {!collapsed && (
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-20 w-60 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={() => setCollapsed(true)}
            className="absolute top-3 -right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-sm"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <SidebarContent onOpenSearch={() => setPaletteOpen(true)} counts={counts} />
        </aside>
      )}

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 z-50 flex w-72 flex-col bg-white dark:bg-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-5 py-4">
              <span className="text-sm font-semibold dark:text-white">Navigation</span>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              onClick={() => setMobileOpen(false)}
              onOpenSearch={() => { setMobileOpen(false); setPaletteOpen(true) }}
              counts={counts}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className={`flex-1 transition-all ${!collapsed ? 'md:ml-60' : 'md:ml-14'}`}>
        {/* Global top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden -ml-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            title="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden md:inline text-slate-400">{crumb.group}</span>
            <ChevronRight className="hidden md:inline h-3.5 w-3.5 shrink-0 text-slate-300" />
            <span className="truncate font-medium text-slate-700 dark:text-slate-200">{crumb.label}</span>
          </div>

          <div className="flex-1" />

          {/* Search */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span>Search…</span>
            <kbd className="rounded border border-slate-200 px-1 text-[10px] font-medium text-slate-400 dark:border-slate-600">⌘K</kbd>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="sm:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            title="Search (⌘K)"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* New menu */}
          <div className="relative">
            <button
              onClick={() => { setNewMenuOpen((o) => !o); setNotifOpen(false) }}
              className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </button>
            {newMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {NEW_ACTIONS.map((a) => {
                    const Icon = a.icon
                    return (
                      <Link
                        key={a.label}
                        to={a.to}
                        onClick={() => setNewMenuOpen(false)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                        {a.label}
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen((o) => !o); setNewMenuOpen(false) }}
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {totalNotifications > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-900">
                  {totalNotifications > 9 ? '9+' : totalNotifications}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">Notifications</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-1">
                    <NotificationRow to="/messages" icon={<MessageSquare className="h-4 w-4 text-indigo-500" />} label="Unread messages" count={counts.unreadCount} onClick={() => setNotifOpen(false)} />
                    <NotificationRow to="/billing" icon={<CreditCard className="h-4 w-4 text-red-500" />} label="Overdue invoices" count={counts.overdueInvoiceCount} onClick={() => setNotifOpen(false)} />
                    <NotificationRow to="/settings" icon={<Users className="h-4 w-4 text-amber-500" />} label="Pending approvals" count={pendingApprovals.length} onClick={() => setNotifOpen(false)} />
                    {totalNotifications === 0 && (
                      <p className="px-3 py-6 text-center text-sm text-slate-400">You're all caught up</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <Outlet />
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <AIAssistant />
    </div>
  )
}
