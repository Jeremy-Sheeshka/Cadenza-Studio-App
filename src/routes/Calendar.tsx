// /calendar — full-featured calendar with Month / Week / Day views,
// event detail/edit modal, sidebar filters, and group lesson templates.

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { getEvents, getStudents, db } from '../lib/api'
import type { CalendarEvent, EventStudent, Category, Location, Student, GroupLessonTemplate } from '../lib/types'
import type { Program, SchedulingSettings } from '../lib/types'
import { Card, PageHeader, Badge, Button, Input } from '../components/ui'

const USER_ID = '56d5b457-8b27-43a2-8b21-74c88944759e'

// ─── inline Select ──────────────────────────────────────────────────────────

function Select({
  value, onChange, children, className = '',
}: { value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; children: ReactNode; className?: string }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
    >
      {children}
    </select>
  )
}

// ─── inline Modal ───────────────────────────────────────────────────────────

function Modal({
  open, onClose, title, children, size = 'md',
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  if (!open) return null
  const w = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-[10vh]">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${w} rounded-2xl border border-slate-200 bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

function time(iso: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}
function dayLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
}
function monthYear(d: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d)
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function startOfWeek(d: Date) {
  const s = new Date(d); s.setDate(s.getDate() - s.getDay()); s.setHours(0, 0, 0, 0); return s
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function minutesSinceMidnight(iso: string) {
  const d = new Date(iso); return d.getHours() * 60 + d.getMinutes()
}

// Convert a Date to a local datetime-local string value
function toDatetimeLocal(d: Date) {
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  return local.toISOString().slice(0, 16)
}
function fromDatetimeLocal(s: string) {
  return new Date(s).toISOString()
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ATTENDANCE_OPTIONS: { label: string; value: EventStudent['attendance_status'] }[] = [
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Attended', value: 'attended' },
  { label: 'Absent', value: 'absent' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Late', value: 'late' },
]
const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  scheduled: 'green', attended: 'green', absent: 'red', cancelled: 'slate', no_show: 'amber', late: 'amber',
}

// ─── local data fetchers (using db directly so we don't need to modify api.ts) ─

async function fetchCategories(): Promise<Category[]> {
  const { data } = await db.from('categories').select('*').eq('user_id', USER_ID)
  return (data as Category[]) ?? []
}
async function fetchLocations(): Promise<Location[]> {
  const { data } = await db.from('locations').select('*').eq('user_id', USER_ID)
  return (data as Location[]) ?? []
}
async function fetchGroupTemplates(): Promise<GroupLessonTemplate[]> {
  const { data } = await db.from('group_lesson_templates').select('*').eq('user_id', USER_ID)
  return (data as GroupLessonTemplate[]) ?? []
}
async function fetchEventStudents(eventId: string): Promise<EventStudent[]> {
  const { data } = await db.from('event_students').select('*').eq('event_id', eventId)
  return (data as EventStudent[]) ?? []
}
async function saveEvent(ev: Partial<CalendarEvent> & { id?: string }): Promise<CalendarEvent | null> {
  const userId = (await db.from('teacher_profiles').select('user_id').maybeSingle())?.data?.user_id
  const payload = { ...ev, user_id: ev.user_id ?? userId }
  if (ev.id) {
    const { data } = await db.from('events').update(payload).eq('id', ev.id).select('*').single()
    return (data as CalendarEvent) ?? null
  } else {
    const { data } = await db.from('events').insert(payload).select('*').single()
    return (data as CalendarEvent) ?? null
  }
}
async function deleteEventById(id: string): Promise<void> {
  await db.from('events').delete().eq('id', id)
}
async function updateAttendance(es: { id: string; attendance_status: string; is_billable: boolean }) {
  await db.from('event_students').update({ attendance_status: es.attendance_status, is_billable: es.is_billable }).eq('id', es.id)
}
async function fetchPrograms(from: string, to: string): Promise<Program[]> {
  const { data } = await db.from('programs')
    .select('id,name,start_date,end_date')
    .eq('user_id', USER_ID)
    .lte('start_date', to)
    .gte('end_date', from)
  return (data ?? []) as Program[]
}
async function fetchSchedulingSettings(): Promise<SchedulingSettings | null> {
  const { data } = await db.from('scheduling_settings')
    .select('*')
    .eq('user_id', USER_ID)
    .maybeSingle()
  return (data as SchedulingSettings) ?? null
}

// ─── Calendar ───────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'day'

export default function Calendar() {
  // view
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

  // data
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [templates, setTemplates] = useState<GroupLessonTemplate[]>([])
  const [_programs, setPrograms] = useState<Program[]>([])
  const [_schedulingSettings, setSchedulingSettings] = useState<SchedulingSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // filters
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set())
  const [locFilter, setLocFilter] = useState<Set<string>>(new Set())

  // modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null)
  const [eventStudents, setEventStudents] = useState<EventStudent[]>([])
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'new'>('view')
  const [saving, setSaving] = useState(false)

  // ─── fetch range ──────────────────────────────────────────────────────────

  const range = useMemo(() => {
    let from: Date, to: Date
    if (viewMode === 'month') {
      from = startOfWeek(startOfMonth(currentDate))
      to = addDays(startOfWeek(startOfMonth(addDays(currentDate, 32))), 41) // generous window
    } else if (viewMode === 'week') {
      from = startOfWeek(currentDate)
      to = addDays(from, 7)
    } else {
      from = new Date(currentDate); from.setHours(0, 0, 0, 0)
      to = addDays(from, 1)
    }
    return { from: from.toISOString(), to: to.toISOString() }
  }, [viewMode, currentDate])

  // ─── load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getEvents(range.from, range.to),
      getStudents(),
      fetchCategories(),
      fetchLocations(),
      fetchGroupTemplates(),
      fetchPrograms(range.from, range.to),
      fetchSchedulingSettings(),
    ]).then(([evts, studs, cats, locs, tmpls, progs, sched]) => {
      setEvents(evts as CalendarEvent[])
      setStudents(studs as Student[])
      setCategories(cats)
      setLocations(locs)
      setTemplates(tmpls)
      setPrograms(progs)
      setSchedulingSettings(sched)
      setLoading(false)
    })
  }, [range.from, range.to])

  // ─── filtered events ──────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (catFilter.size > 0 && e.category_id && !catFilter.has(e.category_id)) return false
      if (locFilter.size > 0 && e.location_id && !locFilter.has(e.location_id)) return false
      return true
    })
  }, [events, catFilter, locFilter])

  // ─── open event detail ────────────────────────────────────────────────────

  function openEvent(ev: CalendarEvent) {
    setSelectedEvent(ev)
    setEditingEvent(null)
    setModalMode('view')
    fetchEventStudents(ev.id).then(setEventStudents)
  }

  function openNewEvent(start?: string, end?: string) {
    setSelectedEvent(null)
    setEventStudents([])
    setEditingEvent({
      title: '',
      start_time: start ?? new Date().toISOString(),
      end_time: end ?? new Date(Date.now() + 3600_000).toISOString(),
      status: 'scheduled',
      is_group: false,
      group_name: null,
      is_billable: true,
      price: null,
      student_id: null,
      category_id: null,
      location_id: null,
    })
    setModalMode('new')
  }

  function editEvent(ev: CalendarEvent) {
    setEditingEvent({ ...ev })
    setModalMode('edit')
  }

  function closeModal() {
    setSelectedEvent(null)
    setEditingEvent(null)
    setEventStudents([])
    setModalMode('view')
  }

  async function handleSave() {
    if (!editingEvent) return
    setSaving(true)
    const saved = await saveEvent(editingEvent)
    setSaving(false)
    if (saved) {
      // refresh
      const [evts] = await Promise.all([getEvents(range.from, range.to)])
      setEvents(evts as CalendarEvent[])
      if (modalMode === 'new') {
        setSelectedEvent(saved)
        setModalMode('view')
        fetchEventStudents(saved.id).then(setEventStudents)
      } else {
        setSelectedEvent(saved)
        setModalMode('view')
        fetchEventStudents(saved.id).then(setEventStudents)
      }
    }
  }

  async function handleDelete() {
    const id = selectedEvent?.id ?? editingEvent?.id
    if (!id) return
    await deleteEventById(id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    closeModal()
  }

  // ─── navigation ───────────────────────────────────────────────────────────

  function nav(amount: number) {
    setCurrentDate((d) => {
      const n = new Date(d)
      if (viewMode === 'month') n.setMonth(n.getMonth() + amount)
      else if (viewMode === 'week') n.setDate(n.getDate() + amount * 7)
      else n.setDate(n.getDate() + amount)
      return n
    })
  }

  function goToday() { setCurrentDate(new Date()) }

  // ─── render helpers ───────────────────────────────────────────────────────

  function eventLabel(ev: CalendarEvent) {
    if (ev.is_group) return ev.group_name ?? 'Group'
    if (ev.student) return `${ev.student.first_name} ${ev.student.last_name}`
    return ev.title ?? 'Untitled'
  }

  // ─── header ───────────────────────────────────────────────────────────────

  const headerLabel = viewMode === 'month'
    ? monthYear(currentDate)
    : viewMode === 'week'
      ? `${dayLabel(startOfWeek(currentDate).toISOString())} – ${dayLabel(addDays(startOfWeek(currentDate), 6).toISOString())}`
      : dayLabel(currentDate.toISOString())

  return (
    <div className="flex gap-4">
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 space-y-4">
        {/* View toggle */}
        <Card>
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  viewMode === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </Card>

        {/* Category filters */}
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Category</h3>
          <div className="space-y-1">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={catFilter.has(c.id)}
                  onChange={() => {
                    setCatFilter((prev) => {
                      const next = new Set(prev)
                      next.has(c.id) ? next.delete(c.id) : next.add(c.id)
                      return next
                    })
                  }}
                  className="rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                />
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-slate-700 truncate">{c.name}</span>
              </label>
            ))}
            {categories.length === 0 && <p className="text-xs text-slate-400">No categories</p>}
          </div>
        </Card>

        {/* Location filters */}
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Location</h3>
          <div className="space-y-1">
            {locations.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={locFilter.has(l.id)}
                  onChange={() => {
                    setLocFilter((prev) => {
                      const next = new Set(prev)
                      next.has(l.id) ? next.delete(l.id) : next.add(l.id)
                      return next
                    })
                  }}
                  className="rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                />
                <span className="text-slate-700 truncate">{l.name}</span>
              </label>
            ))}
            {locations.length === 0 && <p className="text-xs text-slate-400">No locations</p>}
          </div>
        </Card>

        {/* Group lesson templates */}
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Group Templates</h3>
          <div className="space-y-1">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  const d = new Date(currentDate)
                  // Jump to the next occurrence of this template's day_of_week
                  const targetDay = t.day_of_week
                  const currentDay = d.getDay()
                  const diff = (targetDay - currentDay + 7) % 7
                  d.setDate(d.getDate() + (diff === 0 ? 0 : diff))
                  const [h, m] = (t.start_time || '09:00').split(':').map(Number)
                  const start = new Date(d); start.setHours(h, m, 0, 0)
                  const end = new Date(start); end.setMinutes(end.getMinutes() + (t.duration || 60))
                  openNewEvent(start.toISOString(), end.toISOString())
                  // Prefill group fields
                  setEditingEvent((prev) => ({
                    ...prev,
                    is_group: true,
                    group_name: t.group_name,
                    category_id: t.category_id ?? prev?.category_id,
                    location_id: t.location_id ?? prev?.location_id,
                    price: t.default_price ?? prev?.price,
                    group_template_id: t.id,
                  }))
                }}
                className="block w-full text-left px-2 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-800">{t.group_name}</span>
                <span className="ml-1.5 text-slate-400">
                  {DAYS[t.day_of_week]} {t.start_time} ({t.duration}m)
                </span>
              </button>
            ))}
            {templates.length === 0 && <p className="text-xs text-slate-400">No templates</p>}
          </div>
          <Button
            className="mt-3 w-full bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs"
            onClick={() => openNewEvent()}
          >
            + New recurring group lesson
          </Button>
        </Card>
      </aside>

      {/* ── Main calendar area ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <PageHeader
          title="Calendar"
          subtitle={headerLabel}
          action={
            <div className="flex items-center gap-2">
              <Button className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm" onClick={goToday}>Today</Button>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => nav(-1)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">&larr;</button>
                <button onClick={() => nav(1)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors border-l border-slate-200">&rarr;</button>
              </div>
              <Button
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm"
                onClick={() => openNewEvent()}
              >
                + New Event
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading…</div>
        ) : viewMode === 'month' ? (
          <MonthView currentDate={currentDate} events={filteredEvents} onEventClick={openEvent} onSlotClick={(d) => {
            const start = new Date(d); start.setHours(9, 0, 0, 0)
            const end = new Date(d); end.setHours(10, 0, 0, 0)
            openNewEvent(start.toISOString(), end.toISOString())
          }} />
        ) : viewMode === 'week' ? (
          <TimeGridView
            days={7}
            startOfRange={startOfWeek(currentDate)}
            events={filteredEvents}
            onEventClick={openEvent}
            onSlotClick={(d, h, m) => {
              const start = new Date(d); start.setHours(h, m, 0, 0)
              const end = new Date(start); end.setMinutes(end.getMinutes() + 30)
              openNewEvent(start.toISOString(), end.toISOString())
            }}
          />
        ) : (
          <TimeGridView
            days={1}
            startOfRange={new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())}
            events={filteredEvents}
            onEventClick={openEvent}
            onSlotClick={(d, h, m) => {
              const start = new Date(d); start.setHours(h, m, 0, 0)
              const end = new Date(start); end.setMinutes(end.getMinutes() + 30)
              openNewEvent(start.toISOString(), end.toISOString())
            }}
          />
        )}

        {/* ── Event Detail / Edit Modal ──────────────────────────────── */}
        <Modal
          open={!!(selectedEvent || editingEvent)}
          onClose={closeModal}
          title={modalMode === 'new' ? 'New Event' : modalMode === 'edit' ? 'Edit Event' : (selectedEvent ? eventLabel(selectedEvent) : 'Event')}
          size="lg"
        >
          {modalMode === 'view' && selectedEvent ? (
            <EventDetail
              event={selectedEvent}
              eventStudents={eventStudents}
              students={students}
              categories={categories}
              locations={locations}
              onEdit={() => editEvent(selectedEvent)}
              onDelete={handleDelete}
              onStudentsChange={(ess) => { setEventStudents(ess); setSelectedEvent({ ...selectedEvent, event_students: ess }) }}
            />
          ) : editingEvent ? (
            <EventForm
              event={editingEvent}
              students={students}
              categories={categories}
              locations={locations}
              onChange={setEditingEvent}
              onSave={handleSave}
              onDelete={modalMode === 'edit' ? handleDelete : undefined}
              onClose={closeModal}
              saving={saving}
            />
          ) : null}
        </Modal>
      </div>
    </div>
  )
}

// ─── Month View ──────────────────────────────────────────────────────────────

function MonthView({
  currentDate, events, onEventClick, onSlotClick,
}: {
  currentDate: Date; events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void; onSlotClick: (d: Date) => void
}) {
  const monthStart = startOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart)

  // Build 6 rows × 7 cols
  const weeks: Date[][] = []
  let d = gridStart
  for (let w = 0; w < 6; w++) {
    const row: Date[] = []
    for (let c = 0; c < 7; c++) {
      row.push(new Date(d))
      d = addDays(d, 1)
    }
    weeks.push(row)
    // stop if we've gone past the month and filled the row
    if (d.getMonth() !== currentDate.getMonth() && d.getDate() > 7) break
  }

  const today = new Date()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70">
        {DAYS.map((name) => (
          <div key={name} className="px-1 py-2 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
            {name}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7">
        {weeks.flat().map((day, i) => {
          const isToday = sameDay(day, today)
          const isOtherMonth = day.getMonth() !== currentDate.getMonth()
          const dayEvents = events.filter((e) => sameDay(new Date(e.start_time), day))

          return (
            <div
              key={i}
              onClick={() => onSlotClick(day)}
              className={`min-h-[60px] sm:min-h-[80px] md:min-h-[100px] border-r border-b border-slate-100 p-0.5 sm:p-1 cursor-pointer transition-colors hover:bg-slate-50 ${
                isOtherMonth ? 'bg-slate-50/50' : ''
              } ${i % 7 === 6 ? 'border-r-0' : ''}`}
            >
              <div className={`text-[10px] sm:text-xs font-medium mb-0.5 px-0.5 ${
                isToday
                  ? 'inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-blue-500 text-white'
                  : isOtherMonth ? 'text-slate-300' : 'text-slate-600'
              }`}>
                {day.getDate()}
              </div>
              <div className="space-y-px">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}>
                    {eventPillInline(ev, true)}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] sm:text-[10px] text-slate-400 pl-0.5 cursor-pointer hover:text-slate-600"
                    onClick={(e) => { e.stopPropagation(); /* could expand */ }}
                  >
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function eventPillInline(ev: CalendarEvent, compact: boolean) {
  const color = ev.is_group ? '#8B5CF6' : '#14B8A6'
  const label = ev.is_group
    ? (ev.group_name ?? 'Group')
    : ev.student
      ? `${ev.student.first_name} ${ev.student.last_name}`
      : (ev.title ?? 'Untitled')
  return (
    <div
      className={`w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight border cursor-pointer hover:ring-1 hover:ring-slate-300`}
      style={{ backgroundColor: color + '18', borderColor: color + '40', color: color }}
      title={`${label} · ${time(ev.start_time)}–${time(ev.end_time)}`}
    >
      {compact ? `${time(ev.start_time)} ${label}` : `${label} ${time(ev.start_time)}`}
    </div>
  )
}

// ─── Time Grid View (Week / Day) ─────────────────────────────────────────────

function TimeGridView({
  days, startOfRange, events, onEventClick, onSlotClick,
}: {
  days: number; startOfRange: Date; events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void; onSlotClick: (d: Date, hour: number, minute: number) => void
}) {
  const HOUR_START = 6
  const HOUR_END = 22
  const hours: number[] = []
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h)
  const today = new Date()

  const rangeDays: Date[] = []
  for (let i = 0; i < days; i++) rangeDays.push(addDays(startOfRange, i))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b border-slate-200 bg-slate-50/70" style={{ gridTemplateColumns: `60px repeat(${days}, 1fr)` }}>
        <div className="px-2 py-2 text-center text-xs font-semibold text-slate-400" />
        {rangeDays.map((day, i) => {
          const isToday = sameDay(day, today)
          return (
            <div key={i} className={`px-2 py-2 text-center border-l border-slate-200 ${i === 0 ? '' : ''}`}>
              <div className="text-xs font-semibold text-slate-500">{DAYS[day.getDay()]}</div>
              <div className={`text-lg font-semibold ${isToday ? 'text-blue-700' : 'text-slate-800'}`}>{day.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="relative">
          {hours.map((h) => (
            <div key={h} className="grid" style={{ gridTemplateColumns: `60px repeat(${days}, 1fr)` }}>
              {/* Time label */}
              <div className="border-r border-slate-100 pr-2 pt-0 text-right">
                <span className="text-[11px] text-slate-400 -mt-2 block">
                  {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                </span>
              </div>
              {/* Half-hour slots */}
              {[0, 30].map((min) => (
                rangeDays.map((day, di) => (
                  <div
                    key={`${h}:${min}-${di}`}
                    onClick={() => onSlotClick(day, h, min)}
                    className={`border-l border-b border-slate-100 h-[30px] cursor-pointer transition-colors hover:bg-blue-50/50 ${
                      sameDay(day, today) ? 'bg-blue-50/20' : ''
                    } ${di === 0 && days > 1 ? '' : ''}`}
                  />
                ))
              ))}
            </div>
          ))}

          {/* Events overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ top: 0 }}>
            {rangeDays.map((day, di) => {
              const dayStart = new Date(day); dayStart.setHours(HOUR_START, 0, 0, 0)
              const dayEvents = events.filter((e) => sameDay(new Date(e.start_time), day))
              return dayEvents.map((ev) => {
                const startMin = minutesSinceMidnight(ev.start_time)
                const endMin = minutesSinceMidnight(ev.end_time)
                const gridStartMin = HOUR_START * 60
                const top = Math.max(0, startMin - gridStartMin)
                const height = Math.max(15, endMin - startMin)
                const color = ev.is_group ? '#8B5CF6' : '#14B8A6'
                const leftPct = (di / days) * 100
                const widthPct = 100 / days

                return (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                    className="absolute pointer-events-auto cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight border overflow-hidden hover:ring-2 hover:ring-slate-300 hover:z-10 transition-shadow"
                    style={{
                      top: `${(top / ((HOUR_END - HOUR_START) * 60)) * 100}%`,
                      height: `${(height / ((HOUR_END - HOUR_START) * 60)) * 100}%`,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: color + '20',
                      borderColor: color + '50',
                      color: color,
                      zIndex: 5,
                    }}
                  >
                    <span className="block truncate font-semibold">
                      {ev.is_group ? (ev.group_name ?? 'Group') : ev.student ? `${ev.student.first_name} ${ev.student.last_name}` : (ev.title ?? 'Untitled')}
                    </span>
                    <span className="opacity-70">{time(ev.start_time)}</span>
                  </div>
                )
              })
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Event Detail (view mode) ────────────────────────────────────────────────

function EventDetail({
  event, eventStudents, students, categories, locations, onEdit, onDelete, onStudentsChange,
}: {
  event: CalendarEvent; eventStudents: EventStudent[]; students: Student[]; categories: Category[]; locations: Location[];
  onEdit: () => void; onDelete: () => void; onStudentsChange: (ess: EventStudent[]) => void;
}) {
  const student = students.find((s) => s.id === event.student_id)
  const category = categories.find((c) => c.id === event.category_id)
  const location = locations.find((l) => l.id === event.location_id)

  async function changeAttendance(es: EventStudent, newStatus: string) {
    await updateAttendance({ id: es.id, attendance_status: newStatus, is_billable: es.is_billable })
    onStudentsChange(eventStudents.map((s) => s.id === es.id ? { ...s, attendance_status: newStatus as EventStudent['attendance_status'] } : s))
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Status</div>
          <Badge variant={STATUS_TONE[event.status] ?? 'slate'}>{event.status}</Badge>
        </div>
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Date & Time</div>
          <div className="font-medium text-slate-800">{dayLabel(event.start_time)}</div>
          <div className="text-slate-500">{time(event.start_time)} – {time(event.end_time)}</div>
        </div>
        {student && (
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Student</div>
            <div className="font-medium text-slate-800">{student.first_name} {student.last_name}</div>
          </div>
        )}
        {event.is_group && event.group_name && (
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Group</div>
            <div className="font-medium text-slate-800">{event.group_name}</div>
          </div>
        )}
        {category && (
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Category</div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="text-slate-700">{category.name}</span>
            </div>
          </div>
        )}
        {location && (
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Location</div>
            <div className="text-slate-700">{location.name}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Billing</div>
          <div className="text-slate-700">
            {event.is_billable ? `Billable${event.price ? ` · $${(event.price / 100).toFixed(2)}` : ''}` : 'Not billable'}
          </div>
        </div>
      </div>

      {/* Attendance */}
      {eventStudents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-2">Attendance</h4>
          <div className="space-y-1">
            {eventStudents.map((es) => {
              const s = students.find((st) => st.id === es.student_id)
              return (
                <div key={es.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-700">
                    {s ? `${s.first_name} ${s.last_name}` : es.student_id}
                  </span>
                  <div className="flex items-center gap-2">
                    <Select value={es.attendance_status} onChange={(e) => changeAttendance(es, e.target.value)} className="h-8 text-xs w-28">
                      {ATTENDANCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                    <Badge variant={STATUS_TONE[es.attendance_status] ?? 'slate'}>{es.attendance_status}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm" onClick={onEdit}>Edit</Button>
        <Button className="bg-red-50 text-red-600 hover:bg-red-100 text-sm" onClick={() => { if (confirm('Delete this event?')) onDelete() }}>Delete</Button>
      </div>
    </div>
  )
}

// ─── Event Form (create / edit) ──────────────────────────────────────────────

function EventForm({
  event, students, categories, locations, onChange, onSave, onDelete, onClose, saving,
}: {
  event: Partial<CalendarEvent>; students: Student[]; categories: Category[]; locations: Location[];
  onChange: (e: Partial<CalendarEvent>) => void; onSave: () => void; onDelete?: () => void; onClose: () => void; saving: boolean;
}) {
  const set = (k: keyof CalendarEvent, v: unknown) => onChange({ ...event, [k]: v })

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
        <Input value={event.title ?? ''} onChange={(e) => set('title', e.target.value || null)} placeholder="Lesson title" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Student</label>
          <Select value={event.student_id ?? ''} onChange={(e) => set('student_id', e.target.value || null)}>
            <option value="">— None —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
          <Select value={event.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}>
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
          <Input type="datetime-local" value={event.start_time ? toDatetimeLocal(new Date(event.start_time)) : ''}
            onChange={(e) => set('start_time', fromDatetimeLocal(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">End Time</label>
          <Input type="datetime-local" value={event.end_time ? toDatetimeLocal(new Date(event.end_time)) : ''}
            onChange={(e) => set('end_time', fromDatetimeLocal(e.target.value))} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
          <Select value={event.location_id ?? ''} onChange={(e) => set('location_id', e.target.value || null)}>
            <option value="">— None —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Price (cents)</label>
          <Input type="number" value={event.price ?? ''} onChange={(e) => set('price', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 4500" />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={event.is_group ?? false} onChange={(e) => set('is_group', e.target.checked)}
            className="rounded border-slate-300 text-blue-500 focus:ring-blue-400" />
          <span className="text-slate-700">Group lesson</span>
        </label>
        {event.is_group && (
          <div className="flex-1">
            <Input value={event.group_name ?? ''} onChange={(e) => set('group_name', e.target.value || null)} placeholder="Group name" className="h-8 text-sm" />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={event.is_billable ?? true} onChange={(e) => set('is_billable', e.target.checked)}
            className="rounded border-slate-300 text-blue-500 focus:ring-blue-400" />
          <span className="text-slate-700">Billable</span>
        </label>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {onDelete && (
          <Button className="bg-red-50 text-red-600 hover:bg-red-100 text-sm" onClick={() => { if (confirm('Delete this event?')) onDelete() }}>Delete</Button>
        )}
        <Button className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm ml-auto" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}
