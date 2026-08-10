// In production (deployed), use relative URLs (same domain).
// In development, point to the local Express server.
const isProd = import.meta.env.PROD
const BASE = isProd ? '/api' : 'http://localhost:3001/api'

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('cadenza_token')
  const headers: Record<string,string> = { 'Content-Type': 'application/json', ...((options.headers as any) || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  // Backend wraps in { data: ... } — unwrap for callers
  return json.data ?? json
}

export const api = {
  signup: (body: { email:string, password:string, account_type:'teacher'|'student'|'family', display_name:string, extra?:any }) =>
    request('/auth/signup', { method:'POST', body: JSON.stringify(body) }),
  login: (email:string, password:string) =>
    request('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  forgotPassword: (email:string) =>
    request('/auth/forgot-password', { method:'POST', body: JSON.stringify({ email }) }),
  pendingApprovals: () => request('/auth/pending-approvals'),
  approveUser: (userId:string) => request(`/auth/approve/${userId}`, { method:'POST' }),
  getStudents: () => request('/students'),
  getStudent: (id:string) => request(`/students/${id}`),
  createStudent: (body:any) => request('/students', { method:'POST', body: JSON.stringify(body) }),
  updateStudent: (id:string, body:any) => request(`/students/${id}`, { method:'PATCH', body: JSON.stringify(body) }),
  getEvents: () => request('/events'),
  createEvent: (body:any) => request('/events', { method:'POST', body: JSON.stringify(body) }),
  checkin: (eventId:string) => request(`/events/${eventId}/checkin`, { method:'POST' }),
  getResources: () => request('/resources'),
  searchResources: (q:string) => request(`/resources/search?q=${encodeURIComponent(q)}`),
  summarizeLesson: (eventId:string, transcript:string) =>
    request('/ai/summarize-lesson', { method:'POST', body: JSON.stringify({ event_id: eventId, transcript }) }),
  searchLibrary: (query:string) =>
    request('/ai/search-library', { method:'POST', body: JSON.stringify({ query }) }),
  aiStatus: () => request('/ai/status'),

  // Families
  getFamily: (id: string) => request(`/families/${id}`),
  getFamilyStudents: (id: string) => request(`/families/${id}/students`),
  getFamilyInvoices: (id: string) => request(`/families/${id}/invoices`),
  getFamilyPayments: (id: string) => request(`/families/${id}/payments`),
  getFamilyMessages: (id: string) => request(`/families/${id}/messages`),
  getFamilyActivity: (id: string) => request(`/families/${id}/activity`),

  // Lesson notes
  getLessonNotes: (studentIds: string[]) => request(`/lesson-notes?student_ids=${studentIds.join(',')}`),
  createLessonNote: (body: any) => request('/lesson-notes', { method:'POST', body: JSON.stringify(body) }),

  // Practice
  getPracticeSummary: (studentIds: string[], weekStart: string) => request(`/practice/summary?student_ids=${studentIds.join(',')}&week_start=${weekStart}`),
  logPractice: (body: any) => request('/practice', { method:'POST', body: JSON.stringify(body) }),

  // Invoices
  getInvoices: () => request('/invoices'),
  createInvoice: (body: any) => request('/invoices', { method:'POST', body: JSON.stringify(body) }),

  // Messages
  getMessages: () => request('/messages'),
  sendMessage: (body: any) => request('/messages', { method:'POST', body: JSON.stringify(body) }),
}
