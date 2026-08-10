// Complete domain types recovered from production HAR responses and JS bundles.
// Mirrors the real Postgres schema so VITE_USE_MOCK=false works without changes.
// 2026-08-09 — cadenza-studio engagement

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string | null
  phone: string
  user_metadata: {
    full_name?: string
    name?: string
    avatar_url?: string
    picture?: string
  }
  app_metadata: { provider: string; providers: string[] }
}

// ─── Core ────────────────────────────────────────────────────────────────────
export interface TeacherProfile {
  id: string
  user_id: string
  display_name: string | null
  created_at: string
  ical_token: string | null
  onboarding_completed: boolean
  onboarding_completed_at: string | null
  onboarding_dismissed: boolean
  feature_toggles: FeatureToggles
  dashboard_layout: DashboardLayout | null
  country: string | null
  currency: string
  timezone: string
  reply_to_email: string | null
}

export interface FeatureToggles {
  gamification: boolean
  makeup_credits: boolean
  student_portal: boolean
  practice_logging: boolean
  programs_enabled: boolean
  student_practice_mode: 'gamified' | 'timer'
}

export interface DashboardLayout {
  layouts: Record<'lg' | 'md' | 'sm', DashboardWidget[]>
}

export interface DashboardWidget {
  i: string   // widget id e.g. "week-view", "needs-attention", "monthly-revenue"
  x: number; y: number; w: number; h: number
  visible: boolean
}

// ─── Students & Families ─────────────────────────────────────────────────────
export interface Student {
  id: string
  user_id: string
  family_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  birthday: string | null         // "YYYY-MM-DD"
  instrument: string | null
  skill_level: string | null      // "beginner" | "intermediate" | "advanced"
  lesson_duration: number          // minutes
  lesson_price: number             // cents? or dollars?  HAR shows 1500000.0 = $15.00
  monthly_rate: number | null
  notes: string | null
  status: 'active' | 'inactive' | 'prospective' | 'waitlist'
  makeup_credits: number
  created_at: string
  practice_streak: number
  longest_practice_streak: number
  total_practice_minutes: number
  level: number
  points: number
  is_adult: boolean
  // Embeds
  family?: Family | null
  program_enrollments?: { id: string }[]
  student_schedules?: StudentSchedule[]
  student_tags?: StudentTagAssignment[]
}

export interface Family {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  auto_pay_enabled: boolean
  billing_mode: string | null
  billing_frequency: string | null
  stripe_customer_id: string | null
  // Embeds
  contacts?: Contact[]
  students?: Student[]
}

export interface Contact {
  id: string
  user_id: string
  family_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  relationship: string | null
  is_primary: boolean
}

// ─── Calendar & Scheduling ───────────────────────────────────────────────────
export interface CalendarEvent {
  id: string
  user_id: string
  title: string | null
  start_time: string
  end_time: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  student_id: string | null
  location_id: string | null
  category_id: string | null
  is_group: boolean
  group_name: string | null
  group_template_id: string | null
  is_billable: boolean
  is_open_slot: boolean
  price: number | null
  schedule_id: string | null
  schedule_occurrence_date: string | null
  // Embeds
  student?: Student | null
  category?: Category | null
  location?: Location | null
  event_students?: EventStudent[]
}

export interface EventStudent {
  id: string
  event_id: string
  student_id: string
  attendance_status: 'scheduled' | 'attended' | 'absent' | 'cancelled' | 'late'
  is_billable: boolean
  notes: string | null
  private_notes: string | null
  student?: Student | null
}

export interface StudentSchedule {
  id: string
  user_id: string
  student_id: string
  day_of_week: number       // 0=Sunday
  start_time: string        // "HH:MM"
  duration: number           // minutes
  effective_from: string
  student?: Student | null
}

export interface StudentScheduleException {
  id: string
  schedule_id: string
  exception_date: string
  action: 'cancelled' | 'rescheduled' | 'moved'
  new_start_time: string | null
  new_end_time: string | null
}

export interface SchedulingSettings {
  user_id: string
  allow_student_self_booking: boolean
}

export interface GroupLessonTemplate {
  id: string
  user_id: string
  group_name: string
  day_of_week: number
  start_time: string
  duration: number
  max_students: number
  default_price: number | null
  category_id: string | null
  location_id: string | null
  recurrence: 'weekly' | 'biweekly' | 'monthly'
  recurrence_anchor_date: string | null
  is_active: boolean
  // Embeds
  category?: Category | null
  location?: Location | null
}

export interface GroupLessonTemplateStudent {
  id: string
  template_id: string
  student_id: string
  price: number | null
  enrolled_at: string
  template?: GroupLessonTemplate | null
}

// ─── Categories & Locations & Tags ───────────────────────────────────────────
export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface Location {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface StudentTag {
  id: string
  user_id: string
  name: string
}

export interface StudentTagAssignment {
  student_id: string
  tag_id: string
  tag?: StudentTag | null
}

// ─── Billing ─────────────────────────────────────────────────────────────────
export interface Invoice {
  id: string
  user_id: string
  invoice_number: string
  title: string | null
  family_id: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  amount_paid: number
  balance_due: number
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void'
  due_date: string | null
  billing_period_start: string | null
  billing_period_end: string | null
  sent_at: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  // Embeds
  family?: Family | null
  invoice_line_items?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  event_id: string | null
  student_id: string | null
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export interface Payment {
  id: string
  user_id: string
  invoice_id: string | null
  family_id: string | null
  amount: number
  payment_method: PaymentMethod
  payment_date: string
  reference_number: string | null
  notes: string | null
  invoice?: Invoice | null
  family?: Family | null
}

export type PaymentMethod = 'cash' | 'check' | 'card' | 'bank_transfer' | 'venmo' | 'paypal' | 'zelle' | 'other'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash', check: 'Check', card: 'Card', bank_transfer: 'Bank Transfer',
  venmo: 'Venmo', paypal: 'PayPal', zelle: 'Zelle', other: 'Other',
}

export interface BillingSettings {
  user_id: string
  billing_model: string | null
  tax_rate: number
  default_due_days: number
}

export interface RecurringInvoiceTemplate {
  id: string
  user_id: string
  family_id: string | null
  title: string
  frequency: string
  next_run: string | null
  is_active: boolean
  created_at: string
  family?: Family | null
  recurring_invoice_line_items?: RecurringInvoiceLineItem[]
}

export interface RecurringInvoiceLineItem {
  id: string
  template_id: string
  description: string
  quantity: number
  unit_price: number
}

export interface SessionPass {
  id: string
  user_id: string
  student_id: string
  template_id: string | null
  total_sessions: number
  remaining_sessions: number
  purchased_at: string
  is_active: boolean
  template?: GroupLessonTemplate | null
}

// ─── Messaging ───────────────────────────────────────────────────────────────
export interface Conversation {
  id: string
  user_id: string
  family_id: string | null
  teacher_unread_count: number
  family_unread_count: number
  last_message_at: string | null
  family?: Family | null
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_type: 'teacher' | 'family'
  body: string
  created_at: string
  read_at: string | null
}



// ─── Lesson Notes ────────────────────────────────────────────────────────────
export interface LessonNote {
  id: string
  user_id: string
  student_id: string | null
  title: string | null
  body: TipTapDoc | null        // tiptap JSON content
  private_notes: string | null
  status: 'draft' | 'published'
  lesson_date: string | null
  published_at: string | null
  emailed_at: string | null
  created_at: string
  updated_at: string
  fanout_group_id: string | null
  target_student_ids: string[] | null
  student?: Student | null
}

export interface TipTapDoc {
  type: 'doc'
  content: TipTapNode[]
}

export interface TipTapNode {
  type: string
  content?: TipTapNode[]
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export interface LessonNoteTemplate {
  id: string
  user_id: string
  title: string
  body: TipTapDoc | null
  category_id: string | null
  updated_at: string
}

export interface LessonNoteResource {
  id: string
  lesson_note_id: string
  resource_id: string
  resource?: Resource | null
}

// ─── Assignments ─────────────────────────────────────────────────────────────
export interface Assignment {
  id: string
  user_id: string
  title: string
  description: string | null
  assignment_type: AssignmentType
  due_date: string | null
  created_at: string
  assignment_students?: AssignmentStudent[]
  assignment_items?: AssignmentItem[]
}

export type AssignmentType = 'practice_goal' | 'theory' | 'listening' | 'performance' | 'technique'

export interface AssignmentStudent {
  id: string
  assignment_id: string
  student_id: string
  status: 'assigned' | 'in_progress' | 'submitted' | 'graded'
  grade: string | null
  teacher_feedback: string | null
  submission_text: string | null
  submitted_at: string | null
  student?: Student | null
}

export interface AssignmentItem {
  id: string
  assignment_id: string
  title: string
  target_count: number
  sort_order: number
}

export interface AssignmentItemCompletion {
  id: string
  assignment_item_id: string
  assignment_student_id: string
  completed_at: string
}

// ─── Practice ────────────────────────────────────────────────────────────────
export interface PracticeGoal {
  id: string
  user_id: string
  student_id: string
  title: string
  description: string | null
  target_minutes: number
  due_date: string | null
  created_at: string
}

export interface StudentPracticeGoal {
  student_id: string
  days_per_week: number
  minutes_per_session?: number
}

export interface WeeklyPracticeSummary {
  student_id: string
  days_practiced: number
  total_minutes: number
  goal_met: boolean
  points_earned?: number
}

// ─── Resources ───────────────────────────────────────────────────────────────
export interface Resource {
  id: string
  user_id: string
  title: string
  description: string | null
  file_url: string | null
  thumbnail_url: string | null
  folder_id: string | null
  created_at: string
}



export interface StudentResource {
  id: string
  student_id: string
  resource_id: string
  assigned_at: string
  resource?: Resource | null
}

// ─── Programs ────────────────────────────────────────────────────────────────
export interface Program {
  id: string
  user_id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: 'draft' | 'active' | 'completed'
  price: number | null
  created_at: string
}

export interface ProgramEnrollment {
  id: string
  program_id: string
  student_id: string | null
  family_id: string | null
  enrolled_at: string
  payment_status: string | null
  program?: Program | null
}

// ─── Forms ───────────────────────────────────────────────────────────────────
export interface Form {
  id: string
  user_id: string
  title: string
  description: string | null
  fields: FormField[]
  is_active: boolean
  created_at: string
  form_submissions?: { count: number }[]
}

export interface FormField {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'email' | 'phone' | 'file'
  label: string
  required: boolean
  options?: string[]
  placeholder?: string
}

export interface FormSubmission {
  id: string
  form_id: string
  student_id: string | null
  family_id: string | null
  data: Record<string, unknown>
  submitted_at: string
  payment_status?: string | null
}

// ─── Portal ──────────────────────────────────────────────────────────────────
export interface StudentPortalAccess {
  id: string
  family_id: string
  email: string | null
  password_hash: string | null
  last_login: string | null
  lesson_emails_enabled: boolean
  must_change_password: boolean
}

// ─── Roadmap ─────────────────────────────────────────────────────────────────
export interface RoadmapItem {
  id: string
  title: string
  description: string | null
  category: RoadmapCategory
  status: 'planned' | 'in_progress' | 'completed'
  display_order: number
  vote_count: number
  created_at: string
}

export type RoadmapCategory = 'scheduling' | 'billing' | 'communication' | 'portal' | 'analytics' | 'general'

export interface RoadmapSuggestion {
  id: string
  title: string
  description: string
  email: string
  type: 'feature' | 'bug'
  status: 'pending' | 'accepted' | 'declined'
  voter_identifier: string
  promoted_item_id: string | null
  created_at: string
}

// ─── Directory ───────────────────────────────────────────────────────────────
export interface DirectoryProfile {
  id: string
  slug: string
  full_name: string
  instruments: string[]
  city: string | null
  state: string | null
  metro: string | null
  website_url: string | null
  sources: string[]
  opted_out: boolean
  data_completeness: string
  quality_tier: string
  owner_user_id: string | null
  publication_status: string
  profile_type: string
  studio_name: string | null
  profile_image_url: string | null
  bio: string | null
  is_online: boolean
  is_in_person: boolean
  social_links: Record<string, string>
  lesson_formats: string[]
  age_groups: string[]
  years_experience: number | null
  accepting_students: boolean
  availability_summary: string | null
  pricing_summary: string | null
  published_at: string | null
  is_claimed: boolean
}





// ─── User Storage ────────────────────────────────────────────────────────────
export interface UserStorage {
  total_bytes: number
}

// ─── Premium / Billing ───────────────────────────────────────────────────────
export interface PlanLimits {
  billing: boolean
  ical_sync: boolean
  max_students: number
  storage_bytes: number
  auto_invoicing: boolean
  makeup_credits: boolean
  stripe_payments: boolean
  broadcasts_per_month: number
}

export interface Plan {
  id: string
  name: string
  display_name: string
  price_cents: number
  annual_price_cents: number | null
  stripe_price_id: string | null
  annual_stripe_price_id: string | null
  limits: PlanLimits
  features: string[]
  is_active: boolean
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  status: string
  billing_interval: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  billing_provider: string
  has_billing_conflict: boolean
  is_pro: boolean
  plan: Plan
}

// ─── Broadcasts ──────────────────────────────────────────────────────────────
export interface BroadcastMessage {
  id: string
  user_id: string
  subject: string
  body: string
  delivery_status: 'draft' | 'sending' | 'sent'
  recipient_count: number
  created_at: string
  sent_at: string | null
}

export interface BroadcastRecipient {
  id: string
  broadcast_id: string
  family_id: string
  delivery_status: 'pending' | 'delivered' | 'failed'
}

// ─── File Storage ────────────────────────────────────────────────────────────
export interface ResourceFolder {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  created_at: string
}

export interface FileResource {
  id: string
  user_id: string
  name: string
  file_path: string
  file_size: number
  mime_type: string
  folder_id: string | null
  student_ids: string[] | null
  created_at: string
}

// ─── Auto-Invoicing ──────────────────────────────────────────────────────────
export interface AutoInvoiceRule {
  id: string
  user_id: string
  family_id: string | null
  student_id: string | null
  day_of_month: number
  amount_cents: number
  description: string | null
  is_active: boolean
}

// ─── Family Directory & Teacher Discovery ────────────────────────────────────
export interface FamilyHousehold {
  id: string
  account_user_id: string
  guardian_name: string
  email: string
  city: string | null
  state: string | null
  created_at: string
  updated_at: string
}

export interface ProspectiveStudent {
  id: string
  family_household_id: string
  name: string
  age_range: string
  instrument: string
  skill_level: string
  notes: string | null
  lesson_format: string
  location: string | null
  city: string | null
  state: string | null
  travel_distance: number | null
  status: 'open' | 'invited' | 'accepted' | 'declined'
  created_at: string
  updated_at: string
}

export interface DirectoryInquiry {
  id: string
  from_household_id: string
  to_teacher_user_id: string
  listing_id: string | null
  status: 'open' | 'invited' | 'contacted' | 'archived'
  prospective_student_id: string | null
  message: string | null
  created_at: string
  // Denormalized fields returned by get_my_directory_inquiries RPC
  name?: string
  email?: string
  instrument?: string
  age_range?: string
}

export interface DirectoryTeacher {
  id: string
  user_id: string
  display_name: string
  city: string | null
  state: string | null
  instruments: string[]
  ages_taught: string[]
  lesson_formats: string[]
  bio: string | null
  is_verified: boolean
  profile_photo_url: string | null
  created_at: string
}

// ─── DB Table Map ────────────────────────────────────────────────────────────
export interface DBTableMap {
  broadcast_messages: BroadcastMessage
  broadcast_recipients: BroadcastRecipient
  resource_folders: ResourceFolder
  file_resources: FileResource
  auto_invoice_rules: AutoInvoiceRule
  subscriptions: Subscription
  family_households: FamilyHousehold
  prospective_students: ProspectiveStudent
  directory_inquiries: DirectoryInquiry
  directory_teachers_public: DirectoryTeacher
}
