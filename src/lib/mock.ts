// In-memory mock PostgREST transport. Implements the full query surface:
// from().select().eq()/in()/not()/gte()/gt()/lte()/lt().order().limit(),
// .maybeSingle()/.single(), insert().select().single(), upsert(), update(), delete(),
// and rpc(). Seeded with realistic data mirroring HAR responses from the live app.

type Row = Record<string, unknown>

// Split on top-level commas only (ignores parens for embeds like 'student:students(a,b)')
function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' }
    else cur += ch
  }
  if (cur) parts.push(cur)
  return parts
}

interface Filter {
  kind: 'eq' | 'in' | 'not' | 'gte' | 'gt' | 'lte' | 'lt' | 'is'
  col: string
  value: unknown
}

class QueryBuilder {
  private filters: Filter[] = []
  private orders: { col: string; asc: boolean }[] = []
  private limitN = 100
  private singleRow = false
  private cols = '*'

  constructor(private table: string, private store: MockStore) {}

  select(cols: string) { this.cols = cols; return this }
  eq(col: string, value: unknown) { this.filters.push({ kind: 'eq', col, value }); return this }
  in(col: string, value: unknown[]) { this.filters.push({ kind: 'in', col, value }); return this }
  not(col: string, _op: 'is', value: unknown) { this.filters.push({ kind: 'not', col, value }); return this }
  is(col: string, value: unknown) { this.filters.push({ kind: 'is', col, value }); return this }
  gte(col: string, value: unknown) { this.filters.push({ kind: 'gte', col, value }); return this }
  gt(col: string, value: unknown) { this.filters.push({ kind: 'gt', col, value }); return this }
  lte(col: string, value: unknown) { this.filters.push({ kind: 'lte', col, value }); return this }
  lt(col: string, value: unknown) { this.filters.push({ kind: 'lt', col, value }); return this }
  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    this.orders.push({ col, asc: opts.ascending ?? true }); return this
  }
  limit(n: number) { this.limitN = n; return this }
  single() { this.singleRow = true; return this }
  maybeSingle() { this.singleRow = true; return this }

  private execute(): Row[] {
    const tableRows = this.store[this.table]
    let rows: Row[] = Array.isArray(tableRows) ? [...tableRows as Row[]] : []
    rows = rows.filter((r) => this.matches(r))
    for (const o of this.orders) {
      rows = [...rows].sort((a, b) => {
        const av = a[o.col]; const bv = b[o.col]
        if (av == null && bv == null) return 0
        if (av == null) return 1; if (bv == null) return -1
        const c = av < bv ? -1 : av > bv ? 1 : 0
        return o.asc ? c : -c
      })
    }
    return rows.slice(0, this.limitN).map((r) => this.project(r, this.cols))
  }

  private matches(row: Row): boolean {
    for (const f of this.filters) {
      const v = row[f.col]
      switch (f.kind) {
        case 'eq': if (v !== f.value) return false; break
        case 'in': if (!(f.value as unknown[]).includes(v)) return false; break
        case 'not': if (v === null || v === f.value) return false; break
        case 'is':
          if (f.value === null) { if (v !== null && v !== undefined) return false }
          else if (v !== f.value) return false
          break
        case 'gte': if (typeof v === 'string' && typeof f.value === 'string' && v < f.value) return false; break
        case 'gt': if (typeof v === 'string' && typeof f.value === 'string' && v <= f.value) return false; break
        case 'lte': if (typeof v === 'string' && typeof f.value === 'string' && v > f.value) return false; break
        case 'lt': if (typeof v === 'string' && typeof f.value === 'string' && v >= f.value) return false; break
      }
    }
    return true
  }

  private project(row: Row, cols: string): Row {
    const tokens = splitTopLevel(cols)
    if (tokens.length === 1 && tokens[0] === '*') return { ...row }
    const out: Row = tokens.includes('*') ? { ...row } : {}
    for (const c of tokens) {
      const col = c.trim()
      if (col === '*') continue
      // Handle !inner join marker — the table name before !inner
      const cleanCol = col.includes('!inner') ? col.split('!inner')[1] || col : col
      if (cleanCol.includes(':')) {
        const [alias, rest] = cleanCol.split(':')
        const innerCols = rest.slice(rest.indexOf('(') + 1, rest.lastIndexOf(')'))
        const target = rest.slice(0, rest.indexOf('('))
        const fk = target.replace(/s$/, '_id')
        const idVal = row[fk]
        const source = this.store[target]
        if (Array.isArray(source) && idVal != null) {
          const rel = (source as Row[]).find((r) => r.id === idVal)
          if (rel) out[alias] = this.project(rel, innerCols || '*')
          // Don't set null for missing relations — leave undefined
        }
      } else {
        const key = col.split('.')[0] // dotted notation like 'event_students.attendance_status'
        if (row[key] !== undefined) out[key] = row[key]
      }
    }
    return out
  }

  // Mutations — actually modify the store
  private _pendingMutation: 'insert' | 'upsert' | 'update' | 'delete' | null = null
  private _mutationRows: Row[] = []
  private _mutationPatch: Row = {}

  insert(rows: Row | Row[]) {
    this._pendingMutation = 'insert'
    this._mutationRows = Array.isArray(rows) ? rows : [rows]
    return this
  }
  upsert(rows: Row | Row[]) {
    this._pendingMutation = 'upsert'
    this._mutationRows = Array.isArray(rows) ? rows : [rows]
    return this
  }
  update(patch: Row) {
    this._pendingMutation = 'update'
    this._mutationPatch = patch
    return this
  }
  delete() {
    this._pendingMutation = 'delete'
    return this
  }

  // Override then() to handle mutations before resolving
  private async executeMutation(): Promise<Row[]> {
    const tableRows = this.store[this.table]
    let rows: Row[] = Array.isArray(tableRows) ? (tableRows as Row[]) : []

    switch (this._pendingMutation) {
      case 'insert': {
        const inserted = this._mutationRows.map((r) => ({ ...r }))
        rows = [...rows, ...inserted]
        this.store[this.table] = rows
        return inserted
      }
      case 'upsert': {
        for (const row of this._mutationRows) {
          const idx = rows.findIndex((r) => r.id === row.id)
          if (idx >= 0) rows[idx] = { ...rows[idx], ...row }
          else rows.push({ ...row })
        }
        this.store[this.table] = rows
        return this._mutationRows.map((mr) => rows.find((r) => r.id === mr.id) || mr)
      }
      case 'update': {
        rows = rows.map((r) => {
          let match = true
          for (const f of this.filters) {
            if (f.kind === 'eq' && r[f.col] !== f.value) { match = false; break }
          }
          return match ? { ...r, ...this._mutationPatch } : r
        })
        this.store[this.table] = rows
        return rows.filter((r) => {
          for (const f of this.filters) {
            if (f.kind === 'eq' && r[f.col] !== f.value) return false
          }
          return true
        })
      }
      case 'delete': {
        const kept = rows.filter((r) => {
          for (const f of this.filters) {
            if (f.kind === 'eq' && r[f.col] !== f.value) return false
          }
          return false // delete matching rows
        })
        // Actually delete: keep non-matching
        const remaining = rows.filter((r) => {
          for (const f of this.filters) {
            if (f.kind === 'eq' && r[f.col] === f.value) return false
          }
          return true
        })
        this.store[this.table] = remaining
        return kept
      }
      default:
        return []
    }
  }

  // Override then() — return a Promise that resolves to resolve(result), so both
  // `await qb` and `qb.then(cb)` work (chained .then must propagate the value).
  then(resolve: (r: any) => any, reject?: (e: any) => void) {
    const run = (async () => {
      if (this._pendingMutation) {
        const mutated = await this.executeMutation()
        // Support .select().single() after mutation
        if (this.cols !== '*') {
          const projected = mutated.map((r) => this.project(r, this.cols))
          return { data: this.singleRow ? projected[0] : projected, error: null }
        }
        return { data: this.singleRow ? mutated[0] : mutated, error: null }
      }
      const rows = this.execute()
      if (this.singleRow) {
        return { data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116' } }
      }
      return { data: rows, error: null, count: rows.length }
    })()
    return run.then(resolve, reject)
  }
}

class RpcBuilder {
  constructor(private fn: string, private store: MockStore, private args?: Record<string, unknown>) {}
  then(resolve: (r: any) => any, reject?: (e: any) => void) {
    return Promise.resolve().then(() => {
      const rpc = this.store.rpc as (fn: string, args?: Record<string, unknown>) => unknown
      return { data: rpc(this.fn, this.args), error: null }
    }).then(resolve, reject)
  }
}

export interface MockClient {
  from(table: string): QueryBuilder
  rpc(fn: string, args?: Record<string, unknown>): RpcBuilder
  readonly _isMock: true
}

interface MockStore {
  [table: string]: Row[] | ((fn: string, args?: Record<string, unknown>) => unknown)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const USER_ID = (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ?? '56d5b457-8b27-43a2-8b21-74c88944759e'

const iso = (daysOffset: number, hour = 10, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}


// ─── Seed IDs ────────────────────────────────────────────────────────────────
const F1 = '30000000-0000-4000-a000-000000000001'
const F2 = '30000000-0000-4000-a000-000000000002'
const S1 = '40000000-0000-4000-a000-000000000001'
const S2 = '40000000-0000-4000-a000-000000000002'
const S3 = '40000000-0000-4000-a000-000000000003'
const S4 = '40000000-0000-4000-a000-000000000004'
const S5 = '40000000-0000-4000-a000-000000000005'
const S6 = '40000000-0000-4000-a000-000000000006'
const F3 = '30000000-0000-4000-a000-000000000003'
const EV1 = '60000000-0000-4000-a000-000000000001'
const EV2 = '60000000-0000-4000-a000-000000000002'
const EV3 = '60000000-0000-4000-a000-000000000003'
const EV4 = '60000000-0000-4000-a000-000000000004'
const EV5 = '60000000-0000-4000-a000-000000000005'
const INV1 = '70000000-0000-4000-a000-000000000001'
const INV2 = '70000000-0000-4000-a000-000000000002'
const INV3 = '70000000-0000-4000-a000-000000000003'
const CON1 = '80000000-0000-4000-a000-000000000001'
const CON2 = '80000000-0000-4000-a000-000000000002'

export function createMockClient(): MockClient {
  const store: MockStore = {
    // ─── teacher_profiles ──────────────────────────────────────────────────
    teacher_profiles: [{
      id: 'aca648d0-b68e-4602-954a-bdf2fc539fd0',
      user_id: USER_ID,
      display_name: 'Studio Owner',
      created_at: '2026-08-09T00:35:12.367587+00:00',
      ical_token: '8dc6af25-500d-42db-a129-9433d0550c89',
      onboarding_completed: false,
      onboarding_completed_at: null,
      onboarding_dismissed: true,
      feature_toggles: {
        gamification: true,
        makeup_credits: true,
        student_portal: true,
        practice_logging: true,
        programs_enabled: false,
        student_practice_mode: 'gamified',
      },
      dashboard_layout: null,
      country: 'US',
      currency: 'USD',
      timezone: 'America/New_York',
      reply_to_email: null,
    }],

    // ─── families ──────────────────────────────────────────────────────────
    families: [
      {
        id: F1, user_id: USER_ID, name: 'The Rivera Family',
        email: 'rivera@studio.local', phone: '(555) 123-4567',
        address: '123 Oak St, Portland OR 97201',
        notes: null, auto_pay_enabled: true,
        billing_mode: 'per_lesson', billing_frequency: 'monthly',
        stripe_customer_id: null,
      },
      {
        id: F2, user_id: USER_ID, name: 'The Chen-Weber Family',
        email: 'chenweber@studio.local', phone: '(555) 987-6543',
        address: null,
        notes: 'Prefers morning lessons. Two kids in the studio.',
        auto_pay_enabled: false,
        billing_mode: 'per_lesson', billing_frequency: 'monthly',
        stripe_customer_id: null,
      },
      {
        id: F3, user_id: USER_ID, name: 'The Okafor Family',
        email: 'okafors@studio.local', phone: '(555) 456-7890',
        address: '789 Pine Ave',
        notes: 'New family, started in July.',
        auto_pay_enabled: true,
        billing_mode: 'flat_rate', billing_frequency: 'monthly',
        stripe_customer_id: null,
      },
    ],

    // ─── contacts ──────────────────────────────────────────────────────────
    contacts: [
      { id: '51000000-0000-4000-a000-000000000001', user_id: USER_ID, family_id: F1, first_name: 'Maria', last_name: 'Rivera', email: 'maria@studio.local', phone: '(555) 123-4567', relationship: 'Mother', is_primary: true },
      { id: '51000000-0000-4000-a000-000000000002', user_id: USER_ID, family_id: F1, first_name: 'Carlos', last_name: 'Rivera', email: 'carlos@studio.local', phone: null, relationship: 'Father', is_primary: false },
      { id: '51000000-0000-4000-a000-000000000003', user_id: USER_ID, family_id: F2, first_name: 'Lisa', last_name: 'Chen-Weber', email: 'lisa@studio.local', phone: '(555) 987-6543', relationship: 'Mother', is_primary: true },
      { id: '51000000-0000-4000-a000-000000000004', user_id: USER_ID, family_id: F3, first_name: 'Chidi', last_name: 'Okafor', email: 'chidi@studio.local', phone: '(555) 456-7890', relationship: 'Father', is_primary: true },
    ],

    // ─── students ──────────────────────────────────────────────────────────
    students: [
      {
        id: S1, user_id: USER_ID, family_id: F1,
        first_name: 'Sofia', last_name: 'Rivera',
        email: null, phone: null,
        birthday: '2016-03-15',
        instrument: 'Piano', skill_level: 'intermediate',
        lesson_duration: 60, lesson_price: 4500, monthly_rate: 18000,
        notes: 'Preparing for recital. Excellent sight-reader.',
        status: 'active', makeup_credits: 2,
        created_at: '2026-06-01T12:00:00+00:00',
        practice_streak: 12, longest_practice_streak: 18,
        total_practice_minutes: 840, level: 8, points: 1250,
        is_adult: false,
      },
      {
        id: S2, user_id: USER_ID, family_id: F1,
        first_name: 'Mateo', last_name: 'Rivera',
        email: null, phone: null,
        birthday: '2018-09-22',
        instrument: 'Violin', skill_level: 'beginner',
        lesson_duration: 30, lesson_price: 3000, monthly_rate: 12000,
        notes: 'Just started Suzuki Book 2.',
        status: 'active', makeup_credits: 0,
        created_at: '2026-07-15T12:00:00+00:00',
        practice_streak: 4, longest_practice_streak: 7,
        total_practice_minutes: 180, level: 3, points: 340,
        is_adult: false,
      },
      {
        id: S3, user_id: USER_ID, family_id: F2,
        first_name: 'Jordan', last_name: 'Chen-Weber',
        email: null, phone: null,
        birthday: '2015-01-10',
        instrument: 'Drums', skill_level: 'advanced',
        lesson_duration: 60, lesson_price: 5000, monthly_rate: 20000,
        notes: 'Auditioning for youth jazz ensemble.',
        status: 'active', makeup_credits: 1,
        created_at: '2026-05-01T12:00:00+00:00',
        practice_streak: 25, longest_practice_streak: 42,
        total_practice_minutes: 2100, level: 15, points: 3200,
        is_adult: false,
      },
      {
        id: S4, user_id: USER_ID, family_id: F2,
        first_name: 'Emily', last_name: 'Chen-Weber',
        email: null, phone: null,
        birthday: '2013-07-19',
        instrument: 'Flute', skill_level: 'intermediate',
        lesson_duration: 45, lesson_price: 4000, monthly_rate: 16000,
        notes: 'Working on vibrato technique.',
        status: 'active', makeup_credits: 0,
        created_at: '2026-04-01T12:00:00+00:00',
        practice_streak: 8, longest_practice_streak: 14,
        total_practice_minutes: 450, level: 10, points: 980,
        is_adult: false,
      },
      {
        id: S5, user_id: USER_ID, family_id: F3,
        first_name: 'Amara', last_name: 'Okafor',
        email: null, phone: null,
        birthday: '2016-11-02',
        instrument: 'Voice', skill_level: 'beginner',
        lesson_duration: 30, lesson_price: 3000, monthly_rate: 12000,
        notes: 'New student, very enthusiastic.',
        status: 'active', makeup_credits: 0,
        created_at: '2026-07-01T12:00:00+00:00',
        practice_streak: 3, longest_practice_streak: 3,
        total_practice_minutes: 60, level: 2, points: 120,
        is_adult: false,
      },
      {
        id: S6, user_id: USER_ID, family_id: null,
        first_name: 'David', last_name: 'Park',
        email: 'david@studio.local', phone: null,
        birthday: '1988-04-12',
        instrument: 'Guitar', skill_level: 'intermediate',
        lesson_duration: 60, lesson_price: 5000, monthly_rate: 20000,
        notes: 'Adult student, evening lessons only.',
        status: 'prospective', makeup_credits: 0,
        created_at: '2026-08-01T12:00:00+00:00',
        practice_streak: 0, longest_practice_streak: 0,
        total_practice_minutes: 0, level: 0, points: 0,
        is_adult: true,
      },
    ],

    // ─── student_schedules ─────────────────────────────────────────────────
    student_schedules: [
      { id: '41000000-0000-4000-a000-000000000001', user_id: USER_ID, student_id: S1, day_of_week: 2, start_time: '15:30', duration: 60, effective_from: '2026-06-01' },
      { id: '41000000-0000-4000-a000-000000000002', user_id: USER_ID, student_id: S2, day_of_week: 2, start_time: '16:45', duration: 30, effective_from: '2026-07-15' },
      { id: '41000000-0000-4000-a000-000000000003', user_id: USER_ID, student_id: S3, day_of_week: 4, start_time: '17:00', duration: 60, effective_from: '2026-05-01' },
      { id: '41000000-0000-4000-a000-000000000004', user_id: USER_ID, student_id: S4, day_of_week: 4, start_time: '16:00', duration: 45, effective_from: '2026-04-01' },
      { id: '41000000-0000-4000-a000-000000000005', user_id: USER_ID, student_id: S5, day_of_week: 3, start_time: '15:00', duration: 30, effective_from: '2026-07-01' },
    ],

    // ─── categories ────────────────────────────────────────────────────────
    categories: [
      { id: '79e57eec-8d68-4e84-9663-921b0ac1b2a2', user_id: USER_ID, name: 'Private Lesson', color: '#14B8A6', created_at: '2026-08-01T00:00:00+00:00' },
      { id: '79e57eec-8d68-4e84-9663-921b0ac1b2a3', user_id: USER_ID, name: 'Group Class', color: '#8B5CF6', created_at: '2026-08-01T00:00:00+00:00' },
      { id: '79e57eec-8d68-4e84-9663-921b0ac1b2a4', user_id: USER_ID, name: 'Recital', color: '#F59E0B', created_at: '2026-08-01T00:00:00+00:00' },
    ],

    // ─── locations ─────────────────────────────────────────────────────────
    locations: [
      { id: '61000000-0000-4000-a000-000000000001', user_id: USER_ID, name: 'Studio A', created_at: '2026-06-01' },
      { id: '61000000-0000-4000-a000-000000000002', user_id: USER_ID, name: 'Studio B', created_at: '2026-06-01' },
    ],

    // ─── student_tags ──────────────────────────────────────────────────────
    student_tags: [
      { id: '62000000-0000-4000-a000-000000000001', user_id: USER_ID, name: 'Advanced' },
      { id: '62000000-0000-4000-a000-000000000002', user_id: USER_ID, name: 'Recital Prep' },
    ],
    student_tag_assignments: [
      { student_id: S3, tag_id: '62000000-0000-4000-a000-000000000001' },
      { student_id: S1, tag_id: '62000000-0000-4000-a000-000000000002' },
    ],

    // ─── events ────────────────────────────────────────────────────────────
    events: [
      {
        id: EV1, user_id: USER_ID, title: null,
        start_time: iso(2, 15, 30), end_time: iso(2, 16, 30),
        status: 'scheduled', student_id: S1,
        location_id: '61000000-0000-4000-a000-000000000001',
        category_id: '79e57eec-8d68-4e84-9663-921b0ac1b2a2',
        is_group: false, group_name: null, group_template_id: null,
        is_billable: true, is_open_slot: false,
        price: 4500, schedule_id: '41000000-0000-4000-a000-000000000001',
        schedule_occurrence_date: null,
      },
      {
        id: EV2, user_id: USER_ID, title: null,
        start_time: iso(2, 16, 45), end_time: iso(2, 17, 15),
        status: 'scheduled', student_id: S2,
        location_id: '61000000-0000-4000-a000-000000000001',
        category_id: '79e57eec-8d68-4e84-9663-921b0ac1b2a2',
        is_group: false, group_name: null, group_template_id: null,
        is_billable: true, is_open_slot: false,
        price: 3000, schedule_id: '41000000-0000-4000-a000-000000000002',
        schedule_occurrence_date: null,
      },
      {
        id: EV3, user_id: USER_ID, title: 'Group Ear Training',
        start_time: iso(5, 16, 0), end_time: iso(5, 17, 0),
        status: 'scheduled', student_id: null,
        location_id: '61000000-0000-4000-a000-000000000002',
        category_id: '79e57eec-8d68-4e84-9663-921b0ac1b2a3',
        is_group: true, group_name: 'Ear Training I', group_template_id: '63000000-0000-4000-a000-000000000001',
        is_billable: true, is_open_slot: false,
        price: 2500, schedule_id: null, schedule_occurrence_date: null,
      },
      {
        id: EV4, user_id: USER_ID, title: null,
        start_time: iso(3, 16, 0), end_time: iso(3, 16, 45),
        status: 'scheduled', student_id: S4,
        location_id: '61000000-0000-4000-a000-000000000001',
        category_id: '79e57eec-8d68-4e84-9663-921b0ac1b2a2',
        is_group: false, group_name: null, group_template_id: null,
        is_billable: true, is_open_slot: false,
        price: 4000, schedule_id: '41000000-0000-4000-a000-000000000004',
        schedule_occurrence_date: null,
      },
      {
        id: EV5, user_id: USER_ID, title: null,
        start_time: iso(4, 15, 0), end_time: iso(4, 15, 30),
        status: 'scheduled', student_id: S5,
        location_id: '61000000-0000-4000-a000-000000000001',
        category_id: '79e57eec-8d68-4e84-9663-921b0ac1b2a2',
        is_group: false, group_name: null, group_template_id: null,
        is_billable: true, is_open_slot: false,
        price: 3000, schedule_id: '41000000-0000-4000-a000-000000000005',
        schedule_occurrence_date: null,
      },
    ],

    event_students: [
      { id: '64000000-0000-4000-a000-000000000001', event_id: EV1, student_id: S1, attendance_status: 'scheduled', is_billable: true, notes: null, private_notes: null },
      { id: '64000000-0000-4000-a000-000000000002', event_id: EV2, student_id: S2, attendance_status: 'scheduled', is_billable: true, notes: null, private_notes: null },
      { id: '64000000-0000-4000-a000-000000000003', event_id: EV3, student_id: S1, attendance_status: 'scheduled', is_billable: true, notes: null, private_notes: null },
      { id: '64000000-0000-4000-a000-000000000004', event_id: EV3, student_id: S3, attendance_status: 'scheduled', is_billable: true, notes: null, private_notes: null },
    ],

    // ─── scheduling_settings ───────────────────────────────────────────────
    scheduling_settings: [
      { user_id: USER_ID, allow_student_self_booking: true },
    ],

    // ─── group_lesson_templates ────────────────────────────────────────────
    group_lesson_templates: [
      {
        id: '63000000-0000-4000-a000-000000000001', user_id: USER_ID,
        group_name: 'Ear Training I', day_of_week: 5, start_time: '16:00',
        duration: 60, max_students: 8, default_price: 2500,
        category_id: '79e57eec-8d68-4e84-9663-921b0ac1b2a3',
        location_id: '61000000-0000-4000-a000-000000000002',
        recurrence: 'weekly', recurrence_anchor_date: null, is_active: true,
      },
    ],
    group_lesson_template_students: [
      { id: '63100000-0000-4000-a000-000000000001', template_id: '63000000-0000-4000-a000-000000000001', student_id: S1, price: 2500, enrolled_at: '2026-07-01' },
      { id: '63100000-0000-4000-a000-000000000002', template_id: '63000000-0000-4000-a000-000000000001', student_id: S3, price: 2500, enrolled_at: '2026-07-01' },
    ],

    // ─── invoices ──────────────────────────────────────────────────────────
    invoices: [
      {
        id: INV1, user_id: USER_ID, invoice_number: 'INV-2026-0001',
        title: 'August 2026 — Rivera Family',
        family_id: F1, subtotal: 30000, tax: 0, discount: 0, total: 30000,
        amount_paid: 15000, balance_due: 15000,
        status: 'partially_paid',
        due_date: iso(14, 0, 0).slice(0, 10),
        billing_period_start: '2026-08-01', billing_period_end: '2026-08-31',
        sent_at: iso(1, 0, 0), paid_at: null,
        notes: null, created_at: iso(1, 0, 0),
      },
      {
        id: INV2, user_id: USER_ID, invoice_number: 'INV-2026-0002',
        title: 'August 2026 — Chen-Weber Family',
        family_id: F2, subtotal: 20000, tax: 0, discount: 0, total: 20000,
        amount_paid: 0, balance_due: 20000,
        status: 'sent',
        due_date: iso(14, 0, 0).slice(0, 10),
        billing_period_start: '2026-08-01', billing_period_end: '2026-08-31',
        sent_at: iso(1, 0, 0), paid_at: null,
        notes: null, created_at: iso(1, 0, 0),
      },
    ],
    invoice_line_items: [
      { id: '71000000-0000-4000-a000-000000000001', invoice_id: INV1, event_id: null, student_id: S1, description: 'Piano lessons (4×60min)', quantity: 4, unit_price: 4500, amount: 18000 },
      { id: '71000000-0000-4000-a000-000000000002', invoice_id: INV1, event_id: null, student_id: S2, description: 'Violin lessons (4×30min)', quantity: 4, unit_price: 3000, amount: 12000 },
      { id: '71000000-0000-4000-a000-000000000003', invoice_id: INV2, event_id: null, student_id: S3, description: 'Drum lessons (4×60min)', quantity: 4, unit_price: 5000, amount: 20000 },
      { id: '71000000-0000-4000-a000-000000000004', invoice_id: INV2, event_id: null, student_id: S4, description: 'Flute lessons (4×45min)', quantity: 4, unit_price: 4000, amount: 16000 },
      { id: '71000000-0000-4000-a000-000000000005', invoice_id: INV3, event_id: null, student_id: S5, description: 'Voice lessons (4×30min)', quantity: 4, unit_price: 3000, amount: 12000 },
      {
        id: INV3, user_id: USER_ID, invoice_number: 'INV-2026-0003',
        title: 'August 2026 — Okafor Family',
        family_id: F3, subtotal: 12000, tax: 0, discount: 0, total: 12000,
        amount_paid: 12000, balance_due: 0,
        status: 'paid',
        due_date: iso(14, 0, 0).slice(0, 10),
        billing_period_start: '2026-08-01', billing_period_end: '2026-08-31',
        sent_at: iso(1, 0, 0), paid_at: iso(-1, 0, 0),
        notes: null, created_at: iso(1, 0, 0),
      },
    ],

    // ─── payments ──────────────────────────────────────────────────────────
    payments: [
      { id: '72000000-0000-4000-a000-000000000001', user_id: USER_ID, invoice_id: INV1, family_id: F1, amount: 15000, payment_method: 'venmo', payment_date: iso(-2, 0, 0).slice(0, 10), reference_number: 'Venmo-8862', notes: null },
      { id: '72000000-0000-4000-a000-000000000002', user_id: USER_ID, invoice_id: INV3, family_id: F3, amount: 12000, payment_method: 'card', payment_date: iso(-1, 0, 0).slice(0, 10), reference_number: 'STRIPE-4421', notes: null },
    ],

    // ─── recurring_invoice_templates ───────────────────────────────────────
    recurring_invoice_templates: [],
    recurring_invoice_line_items: [],

    // ─── session_passes ────────────────────────────────────────────────────
    session_passes: [],

    // ─── billing_settings ──────────────────────────────────────────────────
    billing_settings: [
      { user_id: USER_ID, billing_model: 'per_lesson', tax_rate: 0, default_due_days: 14 },
    ],

    // ─── conversations ─────────────────────────────────────────────────────
    conversations: [
      { id: CON1, user_id: USER_ID, family_id: F1, teacher_unread_count: 2, family_unread_count: 2, last_message_at: iso(-1, 14, 0) },
      { id: CON2, user_id: USER_ID, family_id: F2, teacher_unread_count: 0, family_unread_count: 0, last_message_at: iso(0, 9, 30) },
    ],
    conversation_messages: [
      { id: '81000000-0000-4000-a000-000000000001', conversation_id: CON2, sender_type: 'family', body: 'Hi! Jordan will be 10 minutes late to his lesson tomorrow — soccer practice runs long.', created_at: iso(0, 9, 30), read_at: null },
    ],

    // ─── plans & subscriptions ──────────────────────────────────────────────
    plans: [
      {
        id: 'studio-local-plan',
        name: 'studio',
        display_name: 'Studio (Local)',
        price_cents: 0,
        annual_price_cents: null,
        stripe_price_id: null,
        annual_stripe_price_id: null,
        limits: {
          billing: true, ical_sync: true, max_students: 999999,
          storage_bytes: 10737418240, auto_invoicing: true,
          makeup_credits: true, stripe_payments: true,
          broadcasts_per_month: 999999,
        },
        features: [
          'Unlimited students', 'Scheduling & calendar', 'Group lessons',
          'Attendance tracking', 'Direct messaging',
          'Student portal with gamification', 'Lesson notes & assignments',
          'Practice logging', 'Auto-invoicing', 'iCal/Google Calendar sync',
          'Makeup credits', 'Unlimited broadcasts', 'CSV & data export',
          '10 GB file storage', 'Local AI assistant (on by default)',
        ],
        is_active: true,
      },
      {
        id: 'network-plan-uuid',
        name: 'network',
        display_name: 'Studio Network',
        price_cents: 2900,
        annual_price_cents: 29000,
        stripe_price_id: null,
        annual_stripe_price_id: null,
        limits: {
          billing: true, ical_sync: true, max_students: 999999,
          storage_bytes: 10737418240, auto_invoicing: true,
          makeup_credits: true, stripe_payments: true,
          broadcasts_per_month: 999999,
        },
        features: [
          'Invite other teachers', 'Shared studio access',
          'Remote login from anywhere', 'Shared billing & payroll',
          'Multi-location support', 'Priority support',
        ],
        is_active: true,
      },
    ],
    subscriptions: [],

    // ─── broadcast_messages ────────────────────────────────────────────────
    broadcast_messages: [
      {
        id: 'bm1', user_id: USER_ID,
        subject: 'Holiday Schedule Update',
        body: 'Hi everyone! Just a reminder that the studio will be closed...',
        delivery_status: 'sent', recipient_count: 3,
        created_at: iso(-5, 0, 0), sent_at: iso(-5, 1, 0),
      },
      {
        id: 'bm2', user_id: USER_ID,
        subject: 'Spring Recital Sign-ups',
        body: 'Registration for the spring recital is now open!...',
        delivery_status: 'draft', recipient_count: 0,
        created_at: iso(-1, 0, 0), sent_at: null,
      },
    ],
    broadcast_recipients: [],

    // ─── lesson_notes ──────────────────────────────────────────────────────
    lesson_notes: [
      {
        id: '37c5b1a0-4c48-4c51-8064-713b8e7f0f12',
        user_id: USER_ID, student_id: S1,
        title: null,
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ text: 'Focused on Chopin Waltz in A minor. Great work on the rubato section — much improved since last week. Next: add pedal on measures 17-24.', type: 'text' }] }] },
        private_notes: 'Mom asked about recital piece — confirm with her.',
        status: 'draft', lesson_date: '2026-08-08',
        published_at: null, emailed_at: null,
        created_at: '2026-08-09T03:58:54+00:00', updated_at: '2026-08-09T03:58:53+00:00',
        fanout_group_id: null, target_student_ids: null,
      },
    ],
    lesson_note_templates: [],
    lesson_note_resources: [],

    // ─── assignments ───────────────────────────────────────────────────────
    assignments: [],
    assignment_students: [],
    assignment_items: [],
    assignment_item_completions: [],

    // ─── practice ──────────────────────────────────────────────────────────
    practice_goals: [],
    student_practice_goals: [
      { student_id: S1, days_per_week: 5, minutes_per_session: 30 },
      { student_id: S2, days_per_week: 4, minutes_per_session: 20 },
      { student_id: S3, days_per_week: 6, minutes_per_session: 45 },
    ],
    weekly_practice_summary: [
      { student_id: S1, days_practiced: 5, total_minutes: 175, goal_met: true, points_earned: 52 },
      { student_id: S2, days_practiced: 3, total_minutes: 65, goal_met: false, points_earned: 21 },
      { student_id: S3, days_practiced: 6, total_minutes: 310, goal_met: true, points_earned: 78 },
    ],

    // ─── resources ─────────────────────────────────────────────────────────
    resources: [
      { id: '90000000-0000-4000-a000-000000000001', user_id: USER_ID, title: 'Major Scales PDF', description: 'All 12 major scales, two octaves', file_url: null, thumbnail_url: null, folder_id: null, created_at: '2026-08-01' },
      { id: '90000000-0000-4000-a000-000000000002', user_id: USER_ID, title: 'Ear Training Interval Chart', description: null, file_url: null, thumbnail_url: null, folder_id: null, created_at: '2026-08-01' },
    ],
    resource_folders: [
      { id: 'f1', user_id: USER_ID, name: 'Sheet Music', parent_id: null, created_at: iso(-30, 0, 0) },
      { id: 'f2', user_id: USER_ID, name: 'Audio Recordings', parent_id: null, created_at: iso(-30, 0, 0) },
      { id: 'f3', user_id: USER_ID, name: 'Method Books', parent_id: 'f1', created_at: iso(-20, 0, 0) },
    ],
    file_resources: [
      { id: 'fr1', user_id: USER_ID, name: 'Fur_Elise_Simplified.pdf', file_path: '/storage/fur_elise.pdf', file_size: 245000, mime_type: 'application/pdf', folder_id: 'f1', student_ids: ['S1'], created_at: iso(-10, 0, 0) },
      { id: 'fr2', user_id: USER_ID, name: 'Scales_Practice_C_Major.pdf', file_path: '/storage/scales_c.pdf', file_size: 120000, mime_type: 'application/pdf', folder_id: 'f1', student_ids: ['S1', 'S2'], created_at: iso(-8, 0, 0) },
      { id: 'fr3', user_id: USER_ID, name: 'Sofia_Week1_Recording.mp3', file_path: '/storage/sofia_w1.mp3', file_size: 3200000, mime_type: 'audio/mpeg', folder_id: 'f2', student_ids: ['S1'], created_at: iso(-5, 0, 0) },
      { id: 'fr4', user_id: USER_ID, name: 'Twinkle_Twinkle_Arrangement.pdf', file_path: '/storage/twinkle.pdf', file_size: 98000, mime_type: 'application/pdf', folder_id: 'f1', student_ids: ['S2'], created_at: iso(-3, 0, 0) },
      { id: 'fr5', user_id: USER_ID, name: 'Hanon_Exercise_1.pdf', file_path: '/storage/hanon1.pdf', file_size: 180000, mime_type: 'application/pdf', folder_id: 'f3', student_ids: [], created_at: iso(-1, 0, 0) },
    ],
    student_resources: [
      { id: '90100000-0000-4000-a000-000000000001', student_id: S1, resource_id: '90000000-0000-4000-a000-000000000001', assigned_at: '2026-08-01' },
    ],

    // ─── programs ──────────────────────────────────────────────────────────
    programs: [],
    program_enrollments: [],

    // ─── forms ─────────────────────────────────────────────────────────────
    forms: [],
    form_submissions: [],

    // ─── student_portal_access ─────────────────────────────────────────────
    student_portal_access: [
      { id: '92000000-0000-4000-a000-000000000001', family_id: F1, email: 'rivera@studio.local', password_hash: '$2a$...', last_login: iso(-3, 18, 0), lesson_emails_enabled: true, must_change_password: false },
      { id: '92000000-0000-4000-a000-000000000002', family_id: F2, email: 'chenweber@studio.local', password_hash: null, last_login: null, lesson_emails_enabled: false, must_change_password: true },
    ],

    // ─── auto-invoicing ────────────────────────────────────────────────────
    auto_invoice_rules: [
      { id: 'air1', user_id: USER_ID, family_id: 'F1', student_id: 'S1', day_of_month: 1, amount_cents: 15000, description: 'Monthly piano lessons - Sofia', is_active: true },
      { id: 'air2', user_id: USER_ID, family_id: 'F2', student_id: null, day_of_month: 15, amount_cents: 20000, description: 'Monthly - Jordan & Taylor', is_active: false },
    ],

    // ─── family directory & teacher discovery ──────────────────────────────
    family_households: [
      {
        id: 'd6e35761-2df1-4a06-bc42-4caba67d02ba',
        account_user_id: USER_ID,
        guardian_name: 'Salmon Bear',
        email: 'yellowsalmonbear@gmail.com',
        city: null, state: null,
        created_at: iso(0, 0, 0), updated_at: iso(0, 0, 0),
      },
    ],
    prospective_students: [
      {
        id: 'ps1', family_household_id: 'd6e35761-2df1-4a06-bc42-4caba67d02ba',
        name: 'Alex', age_range: '9–12', instrument: 'Piano',
        skill_level: 'beginner', notes: 'Wants to learn pop songs',
        lesson_format: 'in_person', location: null,
        city: 'Denver', state: 'CO', travel_distance: 5,
        status: 'open', created_at: iso(-2, 0, 0), updated_at: iso(-2, 0, 0),
      },
      {
        id: 'ps2', family_household_id: 'd6e35761-2df1-4a06-bc42-4caba67d02ba',
        name: 'Jordan', age_range: '13–17', instrument: 'Violin',
        skill_level: 'intermediate', notes: 'Currently in school orchestra',
        lesson_format: 'either', location: null,
        city: null, state: null, travel_distance: null,
        status: 'invited', created_at: iso(-1, 0, 0), updated_at: iso(-1, 0, 0),
      },
    ],
    directory_inquiries: [],
    directory_teachers_public: [
      { id: 'dt1', user_id: USER_ID, display_name: 'Sarah Mitchell', city: 'Denver', state: 'CO', instruments: ['Piano', 'Voice', 'Ukulele'], ages_taught: ['6–8', '9–12', '13–17', '18+'], lesson_formats: ['in_person', 'online'], bio: '10+ years teaching classical and contemporary piano. MM from CU Boulder.', is_verified: true, profile_photo_url: null, created_at: '2026-01-15' },
      { id: 'dt2', user_id: 'other-uuid-1', display_name: 'David Park', city: 'Austin', state: 'TX', instruments: ['Violin', 'Viola', 'Cello'], ages_taught: ['9–12', '13–17', '18+'], lesson_formats: ['in_person'], bio: 'Strings specialist. Former Austin Symphony violist. Suzuki certified.', is_verified: true, profile_photo_url: null, created_at: '2026-02-01' },
      { id: 'dt3', user_id: 'other-uuid-2', display_name: 'Maria Garcia', city: 'Portland', state: 'OR', instruments: ['Guitar', 'Bass', 'Ukulele'], ages_taught: ['6–8', '9–12', '13–17', '18+'], lesson_formats: ['in_person', 'online'], bio: 'All styles welcome — classical, jazz, rock, pop. Beginner-friendly!', is_verified: false, profile_photo_url: null, created_at: '2026-03-10' },
      { id: 'dt4', user_id: 'other-uuid-3', display_name: 'James Chen', city: 'Seattle', state: 'WA', instruments: ['Piano', 'Composition', 'Music Theory'], ages_taught: ['13–17', '18+'], lesson_formats: ['online'], bio: 'Specializing in advanced piano and AP Music Theory prep. DMA candidate.', is_verified: true, profile_photo_url: null, created_at: '2026-04-05' },
      { id: 'dt5', user_id: 'other-uuid-4', display_name: 'Emily Brooks', city: 'Chicago', state: 'IL', instruments: ['Voice', 'Piano', 'Musical Theatre'], ages_taught: ['Under 6', '6–8', '9–12', '13–17'], lesson_formats: ['in_person'], bio: 'Making music fun for kids! Musical theatre and beginning piano specialist.', is_verified: false, profile_photo_url: null, created_at: '2026-05-20' },
    ],

    // ─── roadmap ───────────────────────────────────────────────────────────
    roadmap_items: [
      { id: '93000000-0000-4000-a000-000000000001', title: 'Group lesson self-booking', description: 'Allow families to book group lessons through the portal.', category: 'scheduling', status: 'in_progress', display_order: 1, vote_count: 12, created_at: '2026-07-01' },
      { id: '93000000-0000-4000-a000-000000000002', title: 'Practice streak badges', description: 'Add achievement badges for practice streaks (7, 30, 100 days).', category: 'portal', status: 'planned', display_order: 2, vote_count: 8, created_at: '2026-07-15' },
      { id: '93000000-0000-4000-a000-000000000003', title: 'Bulk invoice PDF export', description: 'Export multiple invoices as a single PDF file.', category: 'billing', status: 'completed', display_order: 3, vote_count: 5, created_at: '2026-06-01' },
    ],
    roadmap_votes: [
      { item_id: '93000000-0000-4000-a000-000000000001', voter_identifier: 'vote-001' },
      { item_id: '93000000-0000-4000-a000-000000000002', voter_identifier: 'vote-002' },
    ],
    roadmap_suggestions: [],

    // ─── attendance ────────────────────────────────────────────────────────
    attendance: [],

    // ─── user_storage (separate table, not RPC) ────────────────────────────
    user_storage: [],

    // ─── RPC functions ─────────────────────────────────────────────────────
    rpc(fn: string, _args?: Record<string, unknown>) {
      switch (fn) {
        case 'get_my_effective_subscription':
          return [{
            id: 'sub-studio',
            user_id: USER_ID,
            plan_id: 'studio-local-plan',
            status: 'active',
            billing_interval: 'month',
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
            billing_provider: 'local',
            has_billing_conflict: false,
            is_pro: true,
            plan: {
              id: 'studio-local-plan',
              name: 'studio',
              display_name: 'Studio (Local)',
              price_cents: 0,
              annual_price_cents: null,
              stripe_price_id: null,
              annual_stripe_price_id: null,
              limits: {
                billing: true, ical_sync: true, max_students: 999999,
                storage_bytes: 10737418240, auto_invoicing: true,
                makeup_credits: true, stripe_payments: true,
                broadcasts_per_month: 999999,
              },
              features: [
                'Unlimited students', 'Scheduling & calendar', 'Group lessons',
                'Attendance tracking', 'Direct messaging',
                'Student portal with gamification', 'Lesson notes & assignments',
                'Practice logging', 'Auto-invoicing', 'iCal/Google Calendar sync',
                'Makeup credits', 'Unlimited broadcasts', 'CSV & data export',
                '10 GB file storage', 'Local AI assistant (on by default)',
              ],
              is_active: true,
            },
          }]

        case 'get_my_account_roles':
          return ['teacher']

        case 'get_my_directory_profile':
        case 'ensure_my_directory_profile':
          return {
            id: '37a9cf2c-f35c-4ef7-ac6c-6fc528309d64',
            slug: 'bumper-bear',
            full_name: 'Studio Owner',
            instruments: [],
            city: null, state: null, metro: null,
            website_url: null,
            sources: ['cadenza-account'],
            raw_data: {},
            opted_out: false,
            data_completeness: 'partial',
            first_scraped_at: '2026-08-09T00:35:12.367587+00:00',
            last_scraped_at: '2026-08-09T00:35:12.367587+00:00',
            created_at: '2026-08-09T00:35:12.367587+00:00',
            updated_at: '2026-08-09T00:35:12.367587+00:00',
            quality_tier: 'seed',
            owner_user_id: USER_ID,
            publication_status: 'draft',
            profile_type: 'teacher',
            studio_name: null,
            profile_image_url: null,
            bio: null,
            is_online: false,
            is_in_person: false,
            social_links: {},
            lesson_formats: [],
            age_groups: [],
            years_experience: null,
            accepting_students: false,
            availability_summary: null,
            pricing_summary: null,
            published_at: null,
            is_claimed: true,
          }

        case 'is_my_directory_profile_pilot_approved':
          return true

        case 'ensure_my_family_household':
          return {
            id: 'd6e35761-2df1-4a06-bc42-4caba67d02ba',
            account_user_id: USER_ID,
            guardian_name: 'Salmon Bear',
            email: 'yellowsalmonbear@gmail.com',
            city: null, state: null,
            created_at: iso(0, 0, 0), updated_at: iso(0, 0, 0),
          }

        case 'list_my_prospective_students':
          return [
            {
              id: 'ps1', family_household_id: 'd6e35761-2df1-4a06-bc42-4caba67d02ba',
              name: 'Alex', age_range: '9–12', instrument: 'Piano',
              skill_level: 'beginner', notes: 'Wants to learn pop songs',
              lesson_format: 'in_person', location: null,
              city: 'Denver', state: 'CO', travel_distance: 5,
              status: 'open', created_at: iso(-2, 0, 0), updated_at: iso(-2, 0, 0),
            },
            {
              id: 'ps2', family_household_id: 'd6e35761-2df1-4a06-bc42-4caba67d02ba',
              name: 'Jordan', age_range: '13–17', instrument: 'Violin',
              skill_level: 'intermediate', notes: 'Currently in school orchestra',
              lesson_format: 'either', location: null,
              city: null, state: null, travel_distance: null,
              status: 'invited', created_at: iso(-1, 0, 0), updated_at: iso(-1, 0, 0),
            },
          ]

        case 'get_my_directory_inquiries':
          return []

        case 'list_my_studio_memberships':
          return []

        case 'cast_vote':
          return { success: true }
        case 'remove_vote':
          return { success: true }
        case 'submit_suggestion':
          return { id: 'sug-0001', success: true }

        default:
          return null
      }
    },
  }

  return {
    _isMock: true as const,
    from(table: string) { return new QueryBuilder(table, store) },
    rpc(fn: string, args?: Record<string, unknown>) { return new RpcBuilder(fn, store, args) },
  }
}
