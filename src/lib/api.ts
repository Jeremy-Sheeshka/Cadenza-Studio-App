// Data-access layer. Mirrors the *exact* query shapes observed in the production
// HAR (02-traffic/cadenza-studio.har): same tables, same filters (user_id=eq.<me>),
// same embeddings (student:students(...)), same HEAD-style counts, same RPCs.
//
// Switches between two transports:
//   - real Supabase client  (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set)
//   - in-memory mock        (VITE_USE_MOCK=1, the default — standalone study)

import { getClient, isMock } from './supabase'
import type {
  TeacherProfile, Student, Family, CalendarEvent, Invoice, Payment,
  Conversation, WeeklyPracticeSummary, BillingSettings, Subscription,
  SchedulingSettings, Category, Location, StudentTag,
  GroupLessonTemplate, ConversationMessage, EventStudent,
  RecurringInvoiceTemplate, SessionPass, Resource, StudentResource,
  Assignment, Program, ProgramEnrollment,
  RoadmapItem, StudentPortalAccess, DirectoryProfile,
  Plan, BroadcastMessage, ResourceFolder, FileResource,
  AutoInvoiceRule, FamilyHousehold, ProspectiveStudent,
  DirectoryInquiry, DirectoryTeacher,
} from './types'

// Minimal query interface both transports must satisfy. Only the patterns the
// app actually uses (from the HAR) are declared — that's the point of the study.
// The concrete type is loose (`any`) because Supabase's builder is generic-heavy
// and the mock is a hand-rolled subset; both are runtime-compatible.

type Queryable = any

// (the security review flagged auto-auth as a deploy-time footgun).
const currentUserId = () =>
  (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ??
  '56d5b457-8b27-43a2-8b21-74c88944759e'

const db: Queryable = getClient()

// Re-export db for direct use by pages that need tables not yet wrapped
export { db }

// ---- teacher profile -----------------------------------------------------

export async function getTeacherProfile(): Promise<TeacherProfile | null> {
  const { data } = await db
    .from('teacher_profiles')
    .select('*')
    .eq('user_id', currentUserId())
    .maybeSingle()
  return data
}

// ---- dashboard (exact HAR queries) --------------------------------------

export async function getDashboardData() {
  const client = db
  // HEAD-style count of open invoices (sent / partially paid / overdue)
  const invoices = await client.from('invoices').select('id').eq('user_id', currentUserId())
    .in('status', ['sent', 'partially_paid', 'overdue'])

  // Upcoming lessons: scheduled events with an attached student
  const upcoming = await client.from('events').select('id').eq('user_id', currentUserId())
    .eq('status', 'scheduled').not('student_id', 'is', null)
    .gte('start_time', new Date().toISOString())

  // Unread conversations
  const unread = await client.from('conversations').select('id,teacher_unread_count').eq('user_id', currentUserId())
    .gt('teacher_unread_count', 0)

  // Active students (ordered by last name)
  const students = await client.from('students')
    .select('id,first_name,last_name')
    .eq('user_id', currentUserId())
    .eq('status', 'active')
    .order('last_name', { ascending: true })

  // Revenue this month
  const payments = await client.from('payments')
    .select('amount')
    .eq('user_id', currentUserId())
    .gte('payment_date', monthStart())
    .limit(1000)

  // Draft lesson notes
  const drafts = await client.from('lesson_notes')
    .select('*,student:students(first_name,last_name)')
    .eq('user_id', currentUserId())
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
    .limit(50)

  // Plan + usage (RPC returns an array — see cadenza-studio.har)
  const subscription = await client.rpc('get_my_effective_subscription')

  return {
    openInvoiceCount: invoices.count ?? invoices.data?.length ?? 0,
    upcomingLessonCount: upcoming.count ?? upcoming.data?.length ?? 0,
    unreadCount: (unread.data ?? []).reduce((s: number, c: any) => s + (c.teacher_unread_count ?? 0), 0),
    activeStudents: students.data ?? [],
    monthRevenue: (payments.data ?? []).reduce((s: number, p: { amount?: number | null }) => s + (p.amount ?? 0), 0),
    draftNotes: drafts.data ?? [],
    subscription: ((subscription.data as Subscription[] | null)?.[0] ?? null) as Subscription | null,
  }
}

// ---- students ------------------------------------------------------------

export async function getStudents() {
  const { data } = await db.from('students')
    .select('*,family:families(*),program_enrollments(id),student_schedules(id)')
    .eq('user_id', currentUserId())
    .order('last_name', { ascending: true })
  return data as (Student & { family: Family | null; program_enrollments: { id: string }[]; student_schedules: { id: string }[] })[]
}

export async function createStudent(input: Partial<Student>) {
  const { data, error } = await db.from('students').insert({
    ...input,
    user_id: currentUserId(),
    status: input.status ?? 'active',
  }).select('*').single()
  return { data, error }
}

// ---- calendar ------------------------------------------------------------

export async function getEvents(from: string, to: string) {
  const { data } = await db.from('events')
    .select('*,student:students(first_name,last_name)')
    .eq('user_id', currentUserId())
    .gte('start_time', from)
    .lte('end_time', to)
    .order('start_time', { ascending: true })
  return data as CalendarEvent[]
}

// ---- scheduling ----------------------------------------------------------

export async function getSchedulingSettings(): Promise<SchedulingSettings | null> {
  const { data } = await db
    .from('scheduling_settings')
    .select('*')
    .eq('user_id', currentUserId())
    .maybeSingle()
  return data
}

export async function updateSchedulingSettings(patch: Partial<SchedulingSettings>): Promise<void> {
  await db
    .from('scheduling_settings')
    .upsert({ ...patch, user_id: currentUserId() })
}

// ---- categories, locations, tags ----------------------------------------

export async function getCategories(): Promise<Category[]> {
  const { data } = await db
    .from('categories')
    .select('*')
    .eq('user_id', currentUserId())
    .order('name', { ascending: true })
  return data
}

export async function createCategory(data: { name: string; color: string }): Promise<Category> {
  const { data: category } = await db
    .from('categories')
    .insert({ ...data, user_id: currentUserId() })
    .select('*')
    .single()
  return category
}

export async function deleteCategory(id: string): Promise<void> {
  await db.from('categories').delete().eq('id', id)
}

export async function getLocations(): Promise<Location[]> {
  const { data } = await db
    .from('locations')
    .select('*')
    .eq('user_id', currentUserId())
    .order('name', { ascending: true })
  return data
}

export async function createLocation(data: { name: string }): Promise<Location> {
  const { data: location } = await db
    .from('locations')
    .insert({ ...data, user_id: currentUserId() })
    .select('*')
    .single()
  return location
}

export async function deleteLocation(id: string): Promise<void> {
  await db.from('locations').delete().eq('id', id)
}

export async function getStudentTags(): Promise<StudentTag[]> {
  const { data } = await db
    .from('student_tags')
    .select('*')
    .eq('user_id', currentUserId())
    .order('name', { ascending: true })
  return data
}

export async function createStudentTag(data: { name: string }): Promise<StudentTag> {
  const { data: tag } = await db
    .from('student_tags')
    .insert({ ...data, user_id: currentUserId() })
    .select('*')
    .single()
  return tag
}

export async function deleteStudentTag(id: string): Promise<void> {
  await db.from('student_tags').delete().eq('id', id)
}

// ---- group templates -----------------------------------------------------

export async function getGroupTemplates(): Promise<GroupLessonTemplate[]> {
  const { data } = await db
    .from('group_lesson_templates')
    .select('*')
    .eq('user_id', currentUserId())
    .order('group_name', { ascending: true })
  return data
}

// ---- messages ------------------------------------------------------------

export async function getConversations() {
  const { data } = await db.from('conversations')
    .select('*,family:families(id,name)')
    .eq('user_id', currentUserId())
    .order('teacher_unread_count', { ascending: false })
  return data as (Conversation & { family: Pick<Family, 'id' | 'name'> | null })[]
}

export async function getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const { data } = await db
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  return data
}

// ---- sidebar badges --------------------------------------------------------

export async function getSidebarCounts() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [unread, todayEvents, overdue] = await Promise.all([
    db.from('conversations')
      .select('id,teacher_unread_count')
      .eq('user_id', currentUserId())
      .gt('teacher_unread_count', 0),
    db.from('events')
      .select('id')
      .eq('user_id', currentUserId())
      .eq('status', 'scheduled')
      .gte('start_time', startOfDay)
      .lt('start_time', endOfDay),
    db.from('invoices')
      .select('id')
      .eq('user_id', currentUserId())
      .in('status', ['sent', 'partially_paid', 'overdue'])
      .lt('due_date', todayStr),
  ])

  return {
    unreadCount: (unread.data ?? []).reduce((s: number, c: any) => s + (c.teacher_unread_count ?? 0), 0),
    todayLessonCount: todayEvents.data?.length ?? 0,
    overdueInvoiceCount: overdue.data?.length ?? 0,
  }
}

// ---- families ------------------------------------------------------------

export async function getFamilies(): Promise<Family[]> {
  const { data } = await db
    .from('families')
    .select('*')
    .eq('user_id', currentUserId())
    .order('name', { ascending: true })
  return data
}

// ---- event students -------------------------------------------------------

export async function getEventStudents(): Promise<EventStudent[]> {
  const { data } = await db
    .from('event_students')
    .select('*,student:students(first_name,last_name)')
  return data
}

// ---- billing -------------------------------------------------------------

export async function getInvoices() {
  const { data } = await db.from('invoices')
    .select('*,family:families(id,name)')
    .eq('user_id', currentUserId())
    .order('due_date', { ascending: false })
  return data as (Invoice & { family: Pick<Family, 'id' | 'name'> | null })[]
}

export async function getPayments() {
  const { data } = await db.from('payments')
    .select('*,invoice:invoices(invoice_number)')
    .eq('user_id', currentUserId())
    .order('payment_date', { ascending: false })
  return data as Payment[]
}

// ---- recurring templates & session passes ---------------------------------

export async function getRecurringTemplates(): Promise<RecurringInvoiceTemplate[]> {
  const { data } = await db
    .from('recurring_invoice_templates')
    .select('*,family:families(*),recurring_invoice_line_items(*)')
    .eq('user_id', currentUserId())
    .order('created_at', { ascending: false })
  return data
}

export async function getSessionPasses(): Promise<SessionPass[]> {
  const { data } = await db
    .from('session_passes')
    .select('*')
    .eq('user_id', currentUserId())
    .order('purchased_at', { ascending: false })
  return data
}

// ---- resources ------------------------------------------------------------

export async function getResources(): Promise<Resource[]> {
  const { data } = await db
    .from('resources')
    .select('*')
    .eq('user_id', currentUserId())
    .order('created_at', { ascending: false })
  return data
}

export async function getStudentResources(): Promise<StudentResource[]> {
  const { data } = await db
    .from('student_resources')
    .select('*,resource:resources(*)')
  return data
}

// ---- assignments ----------------------------------------------------------

export async function getAssignments(): Promise<Assignment[]> {
  const { data } = await db
    .from('assignments')
    .select('*')
    .eq('user_id', currentUserId())
    .order('created_at', { ascending: false })
  return data
}

// ---- programs -------------------------------------------------------------

export async function getPrograms(): Promise<Program[]> {
  const { data } = await db
    .from('programs')
    .select('*')
    .eq('user_id', currentUserId())
    .order('created_at', { ascending: false })
  return data
}

export async function getProgramEnrollments(): Promise<ProgramEnrollment[]> {
  const { data } = await db
    .from('program_enrollments')
    .select('*,program:programs(*)')
  return data
}

// ---- roadmap --------------------------------------------------------------

export async function getRoadmapItems(): Promise<RoadmapItem[]> {
  const { data } = await db
    .from('roadmap_items')
    .select('*')
    .order('display_order', { ascending: true })
  return data
}

export async function castVote(itemId: string, voterId: string): Promise<void> {
  await db.rpc('cast_vote', { item_id: itemId, voter_identifier: voterId })
}

export async function removeVote(itemId: string, voterId: string): Promise<void> {
  await db.rpc('remove_vote', { item_id: itemId, voter_identifier: voterId })
}

// ---- portal ---------------------------------------------------------------

export async function getStudentPortalAccess(): Promise<StudentPortalAccess[]> {
  const { data } = await db
    .from('student_portal_access')
    .select('*')
  return data
}

// ---- directory ------------------------------------------------------------

export async function getDirectoryProfile(): Promise<DirectoryProfile> {
  const { data } = await db.rpc('get_my_directory_profile')
  return data as DirectoryProfile
}

export async function ensureDirectoryProfile(): Promise<DirectoryProfile> {
  const { data } = await db.rpc('ensure_my_directory_profile')
  return data as DirectoryProfile
}

// ---- practice (portal + dashboard widget) --------------------------------

export async function getPracticeSummaries(weekStart: string) {
  const { data } = await db.from('weekly_practice_summary')
    .select('student_id,days_practiced,total_minutes,goal_met,points_earned')
    .eq('week_start', weekStart)
  return data as WeeklyPracticeSummary[]
}

// ---- misc ----------------------------------------------------------------

export async function getBillingSettings(): Promise<BillingSettings | null> {
  const { data } = await db.from('billing_settings')
    .select('*').eq('user_id', currentUserId()).maybeSingle()
  return data
}

export async function getSubscription() {
  if (isMock) {
    const { data } = await db.rpc('get_my_effective_subscription')
    return (Array.isArray(data) ? data[0] : data) as Subscription | null
  }
  const { data } = await db.rpc('get_my_effective_subscription')
  return (Array.isArray(data) ? data[0] : data) as Subscription | null
}

export async function getPlans() {
  const { data } = await db.from('plans').select('*')
  return (data ?? []) as Plan[]
}

// ---- directory teachers ---------------------------------------------------
export async function getDirectoryTeachers(filters?: { instrument?: string; city?: string; format?: string }) {
  const query = db.from('directory_teachers_public').select('*')
  if (filters?.instrument) query.ilike('instruments', `%${filters.instrument}%`)
  const { data } = await query
  return (data ?? []) as DirectoryTeacher[]
}

export async function sendDirectoryInquiry(inquiry: {
  to_teacher_user_id: string
  from_household_id: string
  prospective_student: { name: string; age_range: string; instrument: string; skill_level: string; goals: string; preferred_format: string; city: string; state: string }
  message?: string
}) {
  if (isMock) {
    const psId = `ps-${Date.now()}`
    await db.from('prospective_students').insert({
      id: psId, family_household_id: inquiry.from_household_id,
      name: inquiry.prospective_student.name, age_range: inquiry.prospective_student.age_range,
      instrument: inquiry.prospective_student.instrument, skill_level: inquiry.prospective_student.skill_level,
      notes: inquiry.prospective_student.goals, lesson_format: inquiry.prospective_student.preferred_format,
      city: inquiry.prospective_student.city, state: inquiry.prospective_student.state,
      status: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as any)
    await db.from('directory_inquiries').insert({
      id: `di-${Date.now()}`, from_household_id: inquiry.from_household_id,
      to_teacher_user_id: inquiry.to_teacher_user_id, status: 'open',
      prospective_student_id: psId, message: inquiry.message ?? null,
      created_at: new Date().toISOString(),
    } as any)
    return { success: true }
  }
  const { data } = await db.rpc('upsert_my_prospective_student', { ...inquiry.prospective_student, p_teacher_user_id: inquiry.to_teacher_user_id })
  return { success: true, data }
}

// ---- broadcasts -----------------------------------------------------------
export async function getBroadcasts() {
  const { data } = await db.from('broadcast_messages').select('*').eq('user_id', currentUserId()).order('created_at', { ascending: false })
  return (data ?? []) as BroadcastMessage[]
}

export async function createBroadcast(subject: string, body: string) {
  const { data } = await db.from('broadcast_messages').insert({
    user_id: currentUserId(), subject, body, delivery_status: 'draft',
    recipient_count: 0, created_at: new Date().toISOString(),
  } as any).select('*').single()
  return data as BroadcastMessage
}

// ---- file storage ---------------------------------------------------------
export async function getFileFolders() {
  const { data } = await db.from('resource_folders').select('*').eq('user_id', currentUserId())
  return (data ?? []) as ResourceFolder[]
}

export async function getFiles(folderId?: string | null) {
  let query = db.from('file_resources').select('*').eq('user_id', currentUserId())
  if (folderId !== undefined) query = query.eq('folder_id', folderId)
  const { data } = await query.order('created_at', { ascending: false })
  return (data ?? []) as FileResource[]
}

export async function uploadFile(name: string, folderId: string | null) {
  const { data } = await db.from('file_resources').insert({
    user_id: currentUserId(), name, file_path: `/storage/${name}`,
    file_size: 0, mime_type: 'application/octet-stream', folder_id: folderId,
    created_at: new Date().toISOString(),
  } as any).select('*').single()
  return data as FileResource
}

// ---- auto-invoicing -------------------------------------------------------
export async function getAutoInvoiceRules() {
  const { data } = await db.from('auto_invoice_rules').select('*').eq('user_id', currentUserId())
  return (data ?? []) as AutoInvoiceRule[]
}

// ---- family household -----------------------------------------------------
export async function getMyHousehold() {
  if (isMock) {
    const { data } = await db.rpc('ensure_my_family_household')
    return data as FamilyHousehold | null
  }
  const { data } = await db.rpc('ensure_my_family_household')
  return data as FamilyHousehold | null
}

export async function getProspectiveStudents() {
  if (isMock) {
    const { data } = await db.rpc('list_my_prospective_students')
    return (data ?? []) as ProspectiveStudent[]
  }
  const { data } = await db.rpc('list_my_prospective_students')
  return (data ?? []) as ProspectiveStudent[]
}

export async function getDirectoryInquiries() {
  if (isMock) {
    const { data } = await db.rpc('get_my_directory_inquiries')
    return (data ?? []) as DirectoryInquiry[]
  }
  const { data } = await db.rpc('get_my_directory_inquiries')
  return (data ?? []) as DirectoryInquiry[]
}

const monthStart = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export { isMock }
