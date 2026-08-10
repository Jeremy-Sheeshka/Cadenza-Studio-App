// Teacher app shell — responsive sidebar with toggle at all screen sizes.
// Collapses automatically on wide-content pages (calendar) for more room.

import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, CalendarDays, Users, MessageSquare, FileText,
  BookOpen, CreditCard, GraduationCap, RectangleEllipsis, Settings, LogOut, Inbox,
  Menu, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/lesson-notes', label: 'Lesson Notes', icon: FileText },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/forms', label: 'Forms', icon: RectangleEllipsis },
  { to: '/programs', label: 'Programs', icon: GraduationCap },
  { to: '/resources', label: 'Resources', icon: BookOpen },
  { to: '/directory-leads', label: 'Directory Leads', icon: Inbox },
  { to: '/settings', label: 'Settings', icon: Settings },
]

// Pages that need full width — sidebar defaults to collapsed here
const WIDE_PAGES = ['/calendar']

function SidebarContent({ onClick, collapsed }: { onClick?: () => void; collapsed?: boolean }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 gap-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shrink-0">N</span>
        <nav className="flex-1 space-y-1 w-full px-2">
          {NAV.map(({ to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClick}
              className={({ isActive }) =>
                `flex items-center justify-center rounded-xl p-2 transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                }`
              }
              title={to.replace('/','')}
            >
              <Icon className="h-4 w-4 shrink-0" />
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => { void signOut(); navigate('/app-login') }}
          className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 dark:border-slate-700 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white">
          N
        </span>
        <span className="text-sm font-semibold dark:text-white">Cadenza Studio</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClick}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {user?.display_name?.slice(0, 2).toUpperCase() ?? '??'}
            </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{user?.display_name ?? user?.email}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{user?.account_type ?? ''}</p>
          </div>
        </div>
        <button
          onClick={() => { void signOut(); navigate('/app-login') }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  )
}

export default function AppShell() {
  const location = useLocation()
  const isWidePage = WIDE_PAGES.some((p) => location.pathname.startsWith(p))
  const [collapsed, setCollapsed] = useState(isWidePage)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setCollapsed(isWidePage)
  }, [isWidePage])

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
          <SidebarContent collapsed />
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
          <SidebarContent />
        </aside>
      )}

      {/* Mobile hamburger trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700"
        title="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

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
            <SidebarContent onClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className={`flex-1 transition-all ${!collapsed ? 'md:ml-60' : 'md:ml-14'}`}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
