// /settings — full Settings page with 6 tabs matching production app.trycadenzastudio.com.
// Uses direct db queries for tables not yet exposed via the api.ts helpers.

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { getTeacherProfile, getSubscription, db } from '../lib/api'
import { api } from '../lib/serverApi'
import { useAuth } from '../lib/auth'
import { useFeatureGate } from '../lib/featureGate'
import { useTheme } from '../lib/theme'
import { Card, PageHeader, Badge, Button, Input } from '../components/ui'
import type {
  TeacherProfile, Category, Location, StudentTag,
  SchedulingSettings, Family, Subscription, DirectoryProfile,
  StudentPortalAccess, Student,
} from '../lib/types'

// ─── Local Modal (ui.tsx Modal not yet available) ────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ─── Local Select (ui.tsx Select not yet available) ──────────────────────────
function Select({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
      {...props}
    />
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
type Tab = 'account' | 'directory' | 'teaching' | 'scheduling' | 'portal' | 'subscription' | 'student-views'
const TABS: { key: Tab; label: string }[] = [
  { key: 'account', label: 'Account' },
  { key: 'directory', label: 'Directory' },
  { key: 'teaching', label: 'Teaching' },
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'portal', label: 'Portal' },
  { key: 'student-views', label: 'Student Views' },
  { key: 'subscription', label: 'Subscription' },
]

const COUNTRIES = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'JP', 'BR', 'MX', 'NL', 'SE', 'NO', 'DK', 'FI', 'NZ']
const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'BRL', 'MXN']
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
]
const COLOR_PRESETS = ['#14B8A6', '#8B5CF6', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#10B981', '#6366F1', '#F97316', '#84CC16']

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: 'bg-slate-200', width: '0%' }
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '25%' }
  if (score === 2) return { label: 'Fair', color: 'bg-amber-500', width: '50%' }
  if (score <= 4) return { label: 'Good', color: 'bg-indigo-500', width: '75%' }
  return { label: 'Strong', color: 'bg-indigo-600', width: '100%' }
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { } = useAuth()
  const { usage } = useFeatureGate()
  const { toggle, isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('account')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PageHeader title="Settings" subtitle="Manage your studio" />
        <button onClick={toggle} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors">
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {TABS.filter((t) => t.key !== 'portal' || (usage && usage['storage']?.canUse !== undefined ? true : false)).map((t) => {
          // Portal tab gated by student_portal feature toggle — we check the teacher profile
          return (
            <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </TabButton>
          )
        })}
      </div>

      {tab === 'account' && <AccountTab />}
      {tab === 'directory' && <DirectoryTab />}
      {tab === 'teaching' && <TeachingTab />}
      {tab === 'scheduling' && <SchedulingTab />}
      {tab === 'portal' && <PortalTab />}
      {tab === 'student-views' && <StudentViewsTab />}
      {tab === 'subscription' && <SubscriptionTab />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AccountTab() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('Cadenza Studio')
  const [replyTo, setReplyTo] = useState('')
  const [saving, setSaving] = useState(false)

  // Modals
  const [emailModal, setEmailModal] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [pwModal, setPwModal] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [phoneModal, setPhoneModal] = useState(false)
  const [phone, setPhone] = useState('')

  useEffect(() => {
    getTeacherProfile().then((p) => {
      setProfile(p)
      if (p) {
        setDisplayName(p.display_name ?? 'Cadenza Studio')
        setReplyTo(p.reply_to_email ?? '')
      }
    }).finally(() => setLoading(false))
  }, [])

  const saveAccount = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await db.from('teacher_profiles').update({ display_name: displayName, reply_to_email: replyTo }).eq('user_id', profile?.user_id)
    setSaving(false)
  }

  const handleEmailChange = () => {
    setEmailSent(true)
    setTimeout(() => { setEmailSent(false); setEmailModal(false) }, 2000)
  }

  const handlePasswordChange = (e: FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters'); return }
    if (newPw !== confirmPw) { setPwError('Passwords must match'); return }
    // In production this calls supabase.auth.updateUser({ password: newPw })
    setPwModal(false)
    setNewPw(''); setConfirmPw('')
  }

  const handlePhoneSave = (e: FormEvent) => {
    e.preventDefault()
    // Production: upsert phone via API
    setPhoneModal(false)
  }

  const strength = passwordStrength(newPw)

  if (loading) return <p className="text-sm text-slate-400">Loading account settings…</p>

  return (
    <div className="max-w-2xl space-y-5">
      {/* Display name + reply-to email */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Profile</h3>
        <form onSubmit={saveAccount} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Display name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Reply-to email</label>
            <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="replies@yourstudio.com" />
          </div>
          <Button type="submit" disabled={saving} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </Card>

      {/* Email address */}
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Email address</h3>
        <p className="text-sm text-slate-500">{user?.email ?? '—'}</p>
        <p className="mt-1 text-xs text-slate-400">Read-only from your login provider</p>
        <Button onClick={() => { setEmailSent(false); setEmailModal(true) }} className="mt-3 bg-slate-100 text-slate-700 hover:bg-slate-200">
          Change
        </Button>
      </Card>

      {/* Password */}
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Password</h3>
        <p className="text-sm tracking-widest text-slate-500">••••••••</p>
        <Button onClick={() => { setNewPw(''); setConfirmPw(''); setPwError(''); setPwModal(true) }} className="mt-3 bg-slate-100 text-slate-700 hover:bg-slate-200">
          Change
        </Button>
      </Card>

      {/* Phone number */}
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Phone number</h3>
        <p className="text-sm text-slate-500">Not set</p>
        <Button onClick={() => { setPhone(''); setPhoneModal(true) }} className="mt-3 bg-slate-100 text-slate-700 hover:bg-slate-200">
          Change
        </Button>
      </Card>

      {/* Regional */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Regional</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Country</label>
            <Select value={profile?.country ?? 'US'} onChange={async (e) => {
              await db.from('teacher_profiles').update({ country: e.target.value }).eq('user_id', profile?.user_id)
              setProfile((p) => p ? { ...p, country: e.target.value } : p)
            }}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Currency</label>
            <Select value={profile?.currency ?? 'USD'} onChange={async (e) => {
              await db.from('teacher_profiles').update({ currency: e.target.value }).eq('user_id', profile?.user_id)
              setProfile((p) => p ? { ...p, currency: e.target.value } : p)
            }}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Timezone</label>
            <Select value={profile?.timezone ?? 'America/New_York'} onChange={async (e) => {
              await db.from('teacher_profiles').update({ timezone: e.target.value }).eq('user_id', profile?.user_id)
              setProfile((p) => p ? { ...p, timezone: e.target.value } : p)
            }}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      {/* Email change modal */}
      <Modal open={emailModal} onClose={() => setEmailModal(false)} title="Change email">
        {emailSent ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-indigo-600">Check your inbox</p>
            <p className="mt-1 text-xs text-slate-500">We sent a confirmation link to update your email address.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">A confirmation link will be sent to your new email address.</p>
            <Input type="email" placeholder="New email address" />
            <Button onClick={handleEmailChange} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              Send confirmation link
            </Button>
          </div>
        )}
      </Modal>

      {/* Password change modal */}
      <Modal open={pwModal} onClose={() => setPwModal(false)} title="Change password">
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">New password</label>
            <Input type="password" value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwError('') }} />
            {newPw && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Strength</span>
                  <span className="font-medium text-slate-700">{strength.label}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                  <div className={`h-1.5 rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Confirm password</label>
            <Input type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwError('') }} />
          </div>
          {pwError && <p className="text-xs text-red-600">{pwError}</p>}
          <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            Change password
          </Button>
        </form>
      </Modal>

      {/* Phone change modal */}
      <Modal open={phoneModal} onClose={() => setPhoneModal(false)} title="Change phone number">
        <form onSubmit={handlePhoneSave} className="space-y-3">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
          <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            Save
          </Button>
        </form>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECTORY TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DirectoryTab() {
  const [profile, setProfile] = useState<DirectoryProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      // ensure + fetch directory profile
      await db.rpc('ensure_my_directory_profile')
      const { data } = await db.rpc('get_my_directory_profile')
      setProfile(data as DirectoryProfile | null)
    })().finally(() => setLoading(false))
  }, [])

  const updateField = async (field: string, value: unknown) => {
    setProfile((p) => p ? { ...p, [field]: value } : p)
  }

  const saveDirectory = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    if (profile) {
      await db.from('directory_profiles').upsert({
        ...profile,
        instruments: profile.instruments ?? [],
        social_links: profile.social_links ?? {},
        lesson_formats: profile.lesson_formats ?? [],
        age_groups: profile.age_groups ?? [],
      })
    }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-slate-400">Loading directory settings…</p>
  if (!profile) return <p className="text-sm text-slate-400">Could not load directory profile.</p>

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-4">
        <form onSubmit={saveDirectory} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Studio name</label>
              <Input value={profile.studio_name ?? ''} onChange={(e) => updateField('studio_name', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Publication status</label>
              <Select value={profile.publication_status} onChange={(e) => updateField('publication_status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="unlisted">Unlisted</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Bio</label>
            <textarea
              className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
              value={profile.bio ?? ''}
              onChange={(e) => updateField('bio', e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Instruments (comma separated)</label>
            <Input
              value={(profile.instruments ?? []).join(', ')}
              onChange={(e) => updateField('instruments', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="Piano, Violin, Guitar"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">City</label>
              <Input value={profile.city ?? ''} onChange={(e) => updateField('city', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">State</label>
              <Input value={profile.state ?? ''} onChange={(e) => updateField('state', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Website URL</label>
            <Input value={profile.website_url ?? ''} onChange={(e) => updateField('website_url', e.target.value)} placeholder="https://yourstudio.com" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Years experience</label>
            <Input type="number" value={profile.years_experience ?? ''} onChange={(e) => updateField('years_experience', Number(e.target.value) || null)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Lesson formats (comma separated)</label>
            <Input
              value={(profile.lesson_formats ?? []).join(', ')}
              onChange={(e) => updateField('lesson_formats', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="Individual, Group, Online"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Age groups (comma separated)</label>
            <Input
              value={(profile.age_groups ?? []).join(', ')}
              onChange={(e) => updateField('age_groups', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="Children, Teens, Adults"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={profile.is_online} onChange={(e) => updateField('is_online', e.target.checked)} className="rounded accent-blue-700" />
              Online lessons
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={profile.is_in_person} onChange={(e) => updateField('is_in_person', e.target.checked)} className="rounded accent-blue-700" />
              In-person lessons
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={profile.accepting_students} onChange={(e) => updateField('accepting_students', e.target.checked)} className="rounded accent-blue-700" />
              Accepting students
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Profile image URL</label>
            <Input value={profile.profile_image_url ?? ''} onChange={(e) => updateField('profile_image_url', e.target.value)} />
            {profile.profile_image_url && (
              <img src={profile.profile_image_url} alt="Profile" className="mt-2 h-20 w-20 rounded-lg object-cover" />
            )}
          </div>

          <Button type="submit" disabled={saving} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            {saving ? 'Saving…' : 'Save directory profile'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHING TAB
// ═══════════════════════════════════════════════════════════════════════════════
function TeachingTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [tags, setTags] = useState<StudentTag[]>([])
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Category form
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState('#14B8A6')

  // Location form
  const [locName, setLocName] = useState('')

  // Tag form
  const [tagName, setTagName] = useState('')

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'category' | 'location' | 'tag'; id: string; name: string } | null>(null)

  const loadAll = async () => {
    setLoading(true)
    const profile = await getTeacherProfile()
    const uid = profile?.user_id
    const [cats, locs, tgs, tgAssigns] = await Promise.all([
      db.from('categories').select('*').eq('user_id', uid),
      db.from('locations').select('*').eq('user_id', uid),
      db.from('student_tags').select('*').eq('user_id', uid),
      db.from('student_tag_assignments').select('tag_id'),
    ])
    setCategories(cats.data ?? [])
    setLocations(locs.data ?? [])
    setTags(tgs.data ?? [])
    // count assignments per tag
    const counts: Record<string, number> = {}
    for (const a of (tgAssigns.data ?? []) as { tag_id: string }[]) {
      counts[a.tag_id] = (counts[a.tag_id] || 0) + 1
    }
    setTagCounts(counts)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const addCategory = async (e: FormEvent) => {
    e.preventDefault()
    if (!catName.trim()) return
    const profile = await getTeacherProfile()
    const { data } = await db.from('categories').insert({
      user_id: profile?.user_id, name: catName.trim(), color: catColor,
    }).select('*').single()
    if (data) setCategories((c) => [...c, data as Category])
    setCatName(''); setCatColor('#14B8A6')
  }

  const addLocation = async (e: FormEvent) => {
    e.preventDefault()
    if (!locName.trim()) return
    const profile = await getTeacherProfile()
    const { data } = await db.from('locations').insert({
      user_id: profile?.user_id, name: locName.trim(),
    }).select('*').single()
    if (data) setLocations((l) => [...l, data as Location])
    setLocName('')
  }

  const addTag = async (e: FormEvent) => {
    e.preventDefault()
    if (!tagName.trim()) return
    const profile = await getTeacherProfile()
    const { data } = await db.from('student_tags').insert({
      user_id: profile?.user_id, name: tagName.trim(),
    }).select('*').single()
    if (data) setTags((t) => [...t, data as StudentTag])
    setTagName('')
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { kind, id } = deleteTarget
    if (kind === 'category') {
      await db.from('categories').delete().eq('id', id)
      setCategories((c) => c.filter((x) => x.id !== id))
    } else if (kind === 'location') {
      await db.from('locations').delete().eq('id', id)
      setLocations((l) => l.filter((x) => x.id !== id))
    } else {
      await db.from('student_tags').delete().eq('id', id)
      setTags((t) => t.filter((x) => x.id !== id))
    }
    setDeleteTarget(null)
  }

  if (loading) return <p className="text-sm text-slate-400">Loading teaching settings…</p>

  return (
    <div className="max-w-2xl space-y-6">
      {/* Categories */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Categories</h3>
        <form onSubmit={addCategory} className="mb-4 flex gap-2">
          <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category name" className="flex-1" />
          <div className="flex gap-1 items-center">
            {COLOR_PRESETS.slice(0, 5).map((c) => (
              <button key={c} type="button" onClick={() => setCatColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-all ${catColor === c ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Button type="submit" className="bg-blue-700 text-white text-xs px-3">Add</Button>
        </form>
        {categories.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No categories yet</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-sm text-slate-700">{c.name}</span>
                </div>
                <button onClick={() => setDeleteTarget({ kind: 'category', id: c.id, name: c.name })}
                  className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Locations */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Locations</h3>
        <form onSubmit={addLocation} className="mb-4 flex gap-2">
          <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="New location name" className="flex-1" />
          <Button type="submit" className="bg-blue-700 text-white text-xs px-3">Add</Button>
        </form>
        {locations.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No locations yet</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {locations.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-700">{l.name}</span>
                <button onClick={() => setDeleteTarget({ kind: 'location', id: l.id, name: l.name })}
                  className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Student Tags */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Student Tags</h3>
        <form onSubmit={addTag} className="mb-4 flex gap-2">
          <Input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="New tag name" className="flex-1" />
          <Button type="submit" className="bg-blue-700 text-white text-xs px-3">Add</Button>
        </form>
        {tags.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No tags yet</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-700">
                  {t.name}
                  {tagCounts[t.id] ? <span className="ml-1.5 text-xs text-slate-400">({tagCounts[t.id]} student{tagCounts[t.id] !== 1 ? 's' : ''})</span> : null}
                </span>
                <button onClick={() => setDeleteTarget({ kind: 'tag', id: t.id, name: t.name })}
                  className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm delete">
        <p className="text-sm text-slate-600 mb-4">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button onClick={() => setDeleteTarget(null)} className="bg-slate-100 text-slate-700">Cancel</Button>
          <Button onClick={confirmDelete} className="bg-red-600 text-white">Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULING TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SchedulingTab() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null)
  const [schedSettings, setSchedSettings] = useState<SchedulingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  const load = async () => {
    const p = await getTeacherProfile()
    setProfile(p)
    const { data } = await db.from('scheduling_settings').select('*').eq('user_id', p?.user_id).maybeSingle()
    setSchedSettings(data as SchedulingSettings | null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const regenerateToken = async () => {
    setRegenerating(true)
    const newToken = crypto.randomUUID()
    await db.from('teacher_profiles').update({ ical_token: newToken }).eq('user_id', profile?.user_id)
    setProfile((p) => p ? { ...p, ical_token: newToken } : p)
    setRegenerating(false)
  }

  const toggleSelfBooking = async (val: boolean) => {
    if (!profile) return
    await db.from('scheduling_settings').upsert({ user_id: profile.user_id, allow_student_self_booking: val })
    setSchedSettings((s) => s ? { ...s, allow_student_self_booking: val } : { user_id: profile.user_id, allow_student_self_booking: val })
  }

  const token = profile?.ical_token
  const feedUrl = token ? `https://iuklqvrdzvpkvbgrwlzt.supabase.co/functions/v1/ical-feed/${token}` : null

  if (loading) return <p className="text-sm text-slate-400">Loading scheduling settings…</p>

  return (
    <div className="max-w-2xl space-y-5">
      {/* iCal Feed */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">iCal Feed</h3>
        {token ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Feed URL</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={feedUrl ?? ''}
                  className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600 outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <Button onClick={() => navigator.clipboard?.writeText(feedUrl ?? '')} className="bg-slate-100 text-slate-700 text-xs">
                  Copy
                </Button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Token</label>
              <code className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 break-all">{token}</code>
            </div>
            <Button onClick={regenerateToken} disabled={regenerating} className="bg-amber-100 text-amber-700 hover:bg-amber-200">
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">No iCal token generated yet.</p>
            <Button onClick={regenerateToken} disabled={regenerating} className="bg-blue-700 text-white">
              {regenerating ? 'Generating…' : 'Generate iCal feed'}
            </Button>
          </div>
        )}
      </Card>

      {/* Self-booking toggle */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Student Self-Booking</h3>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={schedSettings?.allow_student_self_booking ?? false}
            onChange={(e) => toggleSelfBooking(e.target.checked)}
            className="h-5 w-5 rounded accent-blue-700"
          />
          <span className="text-sm text-slate-700">Allow students to book lessons through the portal</span>
        </label>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL TAB
// ═══════════════════════════════════════════════════════════════════════════════
function PortalTab() {
  const [accessRows, setAccessRows] = useState<(StudentPortalAccess & { family?: Family })[]>([])
  const [_families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  // Edit credentials modal
  const [editTarget, setEditTarget] = useState<StudentPortalAccess | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')

  // Disable confirm
  const [disableTarget, setDisableTarget] = useState<StudentPortalAccess | null>(null)

  useEffect(() => {
    (async () => {
      const profile = await getTeacherProfile()
      const famRes = await db.from('families').select('id,name').eq('user_id', profile?.user_id)
      const famData = (famRes.data ?? []) as Pick<Family, 'id' | 'name'>[]
      const familyIds = famData.map((f) => f.id)

      let accRes = { data: [] as StudentPortalAccess[] }
      if (familyIds.length > 0) {
        accRes = await db.from('student_portal_access').select('*').in('family_id', familyIds) as { data: StudentPortalAccess[] }
      }
      const accessData = (accRes.data ?? []) as StudentPortalAccess[]
      const famDataFull = (famRes.data ?? []) as Pick<Family, 'id' | 'name'>[]

      // Attach family info
      const enriched = accessData.map((a) => ({
        ...a,
        family: famDataFull.find((f) => f.id === a.family_id) as Family | undefined,
      }))
      setAccessRows(enriched)
      setFamilies(famDataFull as unknown as Family[])
      setLoading(false)
    })()
  }, [])

  const filtered = accessRows.filter((row) => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = row.family?.name?.toLowerCase() ?? ''
    const email = row.email?.toLowerCase() ?? ''
    return name.includes(q) || email.includes(q)
  })

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const saveCredentials = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    await db.from('student_portal_access').update({
      email: editEmail,
      ...(editPassword ? { password_hash: '[updated]', must_change_password: false } : {}),
    }).eq('id', editTarget.id)
    setAccessRows((rows) => rows.map((r) => r.id === editTarget.id ? { ...r, email: editEmail } : r))
    setEditTarget(null)
  }

  const disableAccess = async () => {
    if (!disableTarget) return
    await db.from('student_portal_access').update({ password_hash: null }).eq('id', disableTarget.id)
    setAccessRows((rows) => rows.map((r) => r.id === disableTarget.id ? { ...r, password_hash: null } : r))
    setDisableTarget(null)
  }

  if (loading) return <p className="text-sm text-slate-400">Loading portal settings…</p>

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Family Portal Access</h3>
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search families…"
          className="mb-4"
        />

        {paged.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">No families with portal access found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 font-medium">Family</th>
                    <th className="py-2 font-medium">Students</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Last login</th>
                    <th className="py-2 font-medium">Password</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map((row) => {
                    const studentCount = row.family?.students?.length ?? 0
                    const isEnabled = !!row.password_hash
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="py-2.5 text-slate-900">{row.family?.name ?? '—'}</td>
                        <td className="py-2.5 text-slate-600">{studentCount}</td>
                        <td className="py-2.5">
                          <Badge variant={isEnabled ? 'green' : 'slate'}>{isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                        </td>
                        <td className="py-2.5 text-xs text-slate-500">
                          {row.last_login ? new Date(row.last_login).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-2.5">
                          {row.must_change_password ? (
                            <Badge variant="amber">Change required</Badge>
                          ) : isEnabled ? (
                            <span className="text-xs text-slate-500">Set</span>
                          ) : (
                            <span className="text-xs text-slate-400">Not set</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditTarget(row); setEditEmail(row.email ?? ''); setEditPassword('') }}
                              className="text-xs text-blue-700 hover:text-blue-900"
                            >
                              Edit credentials
                            </button>
                            {isEnabled && (
                              <button
                                onClick={() => setDisableTarget(row)}
                                className="text-xs text-red-500 hover:text-red-700 ml-2"
                              >
                                Disable
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Page {page + 1} of {totalPages} ({filtered.length} families)
                </span>
                <div className="flex gap-1">
                  <Button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="text-xs px-3 bg-slate-100 text-slate-700">
                    Previous
                  </Button>
                  <Button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-xs px-3 bg-slate-100 text-slate-700">
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Edit credentials modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit portal credentials">
        <form onSubmit={saveCredentials} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Family</label>
            <p className="text-sm text-slate-700">{(editTarget as any)?.family?.name ?? editTarget?.email}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
            <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">New password (leave blank to keep)</label>
            <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            Save credentials
          </Button>
        </form>
      </Modal>

      {/* Disable confirm modal */}
      <Modal open={!!disableTarget} onClose={() => setDisableTarget(null)} title="Disable portal access">
        <p className="text-sm text-slate-600 mb-4">
          This will remove the password for <strong>{(disableTarget as any)?.family?.name ?? disableTarget?.email}</strong>.
          The family will no longer be able to log in to the portal.
        </p>
        <div className="flex gap-2 justify-end">
          <Button onClick={() => setDisableTarget(null)} className="bg-slate-100 text-slate-700">Cancel</Button>
          <Button onClick={disableAccess} className="bg-red-600 text-white">Disable access</Button>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SubscriptionTab() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // Export state
  const [exportType, setExportType] = useState('student_roster')
  const [exportOptions, setExportOptions] = useState<Record<string, boolean>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    getSubscription().then((s) => { setSub(s) }).finally(() => setLoading(false))
  }, [])

  const isPro = sub?.is_pro ?? false

  const toastMsg = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleExport = async () => {
    setExporting(true)
    // Simulate export — production calls supabase functions
    await new Promise((r) => setTimeout(r, 800))
    toastMsg(`${EXPORT_TYPES.find((et) => et.key === exportType)?.label ?? 'Export'} downloaded successfully`)
    setExporting(false)
  }

  if (loading) return <p className="text-sm text-slate-400">Loading subscription…</p>
  if (!sub) return <p className="text-sm text-slate-400">Could not load subscription.</p>

  return (
    <div className="max-w-2xl space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      {/* Plan */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Current plan</h3>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={isPro ? 'green' : 'slate'}>{sub.plan.display_name}</Badge>
              <span className="text-xs text-slate-400">{sub.billing_interval === 'month' ? 'Monthly' : 'Annual'}</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-xs font-medium text-slate-500 mb-2">Plan features</h4>
          <ul className="space-y-1.5">
            {(sub.plan.features ?? []).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 text-indigo-500">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          {isPro ? (
            <Button
              onClick={() => toastMsg('Opening Stripe billing portal…')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              Manage Subscription
            </Button>
          ) : (
            <Button
              onClick={() => toastMsg('Redirecting to upgrade…')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              Upgrade to Pro
            </Button>
          )}
        </div>
      </Card>

      {/* Data Export */}
      <Card className="p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Data Export</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Export type</label>
            <Select value={exportType} onChange={(e) => setExportType(e.target.value)}>
              {EXPORT_TYPES.map((et) => (
                <option key={et.key} value={et.key}>{et.label}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">Include</label>
            <div className="space-y-2">
              {(EXPORT_TYPES.find((et) => et.key === exportType)?.options ?? []).map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={exportOptions[opt.key] ?? true}
                    onChange={(e) => setExportOptions((o) => ({ ...o, [opt.key]: e.target.checked }))}
                    className="rounded accent-blue-700"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleExport} disabled={exporting} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            {exporting ? 'Exporting…' : 'Download'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT VIEWS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const STUDENT_VIEW_DEFAULTS = {
  showAssignments: true,
  showBilling: false,
  showResources: true,
  showPracticeTracker: true,
  showLeaderboard: false,
  gamifiedMode: true,
}

interface StudentViewPrefs {
  showAssignments: boolean
  showBilling: boolean
  showResources: boolean
  showPracticeTracker: boolean
  showLeaderboard: boolean
  gamifiedMode: boolean
}

function getStudentPrefs(studentId: string): StudentViewPrefs {
  try {
    const raw = localStorage.getItem(`cadenza_student_prefs_${studentId}`)
    if (raw) return { ...STUDENT_VIEW_DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...STUDENT_VIEW_DEFAULTS }
}

function saveStudentPrefs(studentId: string, prefs: StudentViewPrefs) {
  localStorage.setItem(`cadenza_student_prefs_${studentId}`, JSON.stringify(prefs))
}

function TogglePill({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors ${
          on
            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  )
}

function StudentViewsTab() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [prefsMap, setPrefsMap] = useState<Record<string, StudentViewPrefs>>({})

  useEffect(() => {
    api.getStudents().then((data: Student[]) => {
      setStudents(data ?? [])
      const map: Record<string, StudentViewPrefs> = {}
      for (const s of data ?? []) {
        map[s.id] = getStudentPrefs(s.id)
      }
      setPrefsMap(map)
    }).finally(() => setLoading(false))
  }, [])

  const updatePref = (studentId: string, key: keyof StudentViewPrefs, value: boolean) => {
    const next = { ...prefsMap[studentId], [key]: value }
    setPrefsMap((prev) => ({ ...prev, [studentId]: next }))
    saveStudentPrefs(studentId, next)
  }

  const applyToAll = () => {
    const map: Record<string, StudentViewPrefs> = {}
    for (const s of students) {
      map[s.id] = { ...STUDENT_VIEW_DEFAULTS }
      saveStudentPrefs(s.id, map[s.id])
    }
    setPrefsMap(map)
  }

  if (loading) return <p className="text-sm text-slate-400">Loading students…</p>

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Customize Student Portals</h2>
        <p className="text-sm text-slate-500 mt-1">Control which features each student sees in their portal</p>
      </div>

      {students.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-slate-400">No students found.</p>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              onClick={applyToAll}
              className="bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Apply to All
            </Button>
          </div>

          {students.map((student) => {
            const prefs = prefsMap[student.id] ?? STUDENT_VIEW_DEFAULTS
            return (
              <Card key={student.id} className="p-4 space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {student.first_name} {student.last_name}
                  </h3>
                  {student.instrument && (
                    <Badge variant="teal">{student.instrument}</Badge>
                  )}
                </div>
                <TogglePill label="Show Assignments" on={prefs.showAssignments} onChange={(v) => updatePref(student.id, 'showAssignments', v)} />
                <TogglePill label="Show Billing" on={prefs.showBilling} onChange={(v) => updatePref(student.id, 'showBilling', v)} />
                <TogglePill label="Show Resources" on={prefs.showResources} onChange={(v) => updatePref(student.id, 'showResources', v)} />
                <TogglePill label="Show Practice Tracker" on={prefs.showPracticeTracker} onChange={(v) => updatePref(student.id, 'showPracticeTracker', v)} />
                <TogglePill label="Show Leaderboard" on={prefs.showLeaderboard} onChange={(v) => updatePref(student.id, 'showLeaderboard', v)} />
                <TogglePill label="Gamified Mode" on={prefs.gamifiedMode} onChange={(v) => updatePref(student.id, 'gamifiedMode', v)} />
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}

const EXPORT_TYPES = [
  {
    key: 'student_roster', label: 'Student Roster',
    options: [
      { key: 'name', label: 'Name' },
      { key: 'instrument', label: 'Instrument' },
      { key: 'skill_level', label: 'Skill level' },
      { key: 'status', label: 'Status' },
      { key: 'family', label: 'Family' },
    ],
  },
  {
    key: 'family_contacts', label: 'Family Contacts',
    options: [
      { key: 'family_name', label: 'Family name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'students', label: 'Students' },
    ],
  },
  {
    key: 'attendance', label: 'Attendance Records',
    options: [
      { key: 'student', label: 'Student' },
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'duration', label: 'Duration' },
    ],
  },
  {
    key: 'invoice_history', label: 'Invoice History',
    options: [
      { key: 'invoice_number', label: 'Invoice number' },
      { key: 'family', label: 'Family' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
      { key: 'due_date', label: 'Due date' },
    ],
  },
  {
    key: 'payment_records', label: 'Payment Records',
    options: [
      { key: 'date', label: 'Date' },
      { key: 'amount', label: 'Amount' },
      { key: 'method', label: 'Method' },
      { key: 'invoice', label: 'Invoice' },
    ],
  },
  {
    key: 'tax_summary', label: 'Tax Summary',
    options: [
      { key: 'period', label: 'Period' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'tax_collected', label: 'Tax collected' },
      { key: 'expenses', label: 'Expenses' },
    ],
  },
]
