// FamilyDirectory — teacher directory browser for families.
// Route: /family-directory (authenticated).

import { useEffect, useState, useMemo } from 'react'
import {
  Search, MapPin, Music, ShieldCheck, Mail, Filter,
} from 'lucide-react'
import { getDirectoryTeachers, sendDirectoryInquiry, getMyHousehold } from '../lib/api'
import type { DirectoryTeacher, FamilyHousehold } from '../lib/types'
import {
  PageHeader, Card, CardContent, Badge, Button, Input, Select, Modal, EmptyState,
  useToast,
} from '../components/ui'
import { cn } from '../lib/utils'

// ─── Constants ───────────────────────────────────────────────────────────────

const INSTRUMENT_FILTERS = ['All', 'Piano', 'Strings', 'Voice', 'Guitar'] as const

const AGE_RANGE_OPTIONS = [
  { value: 'Under 6', label: 'Under 6' },
  { value: '6–8', label: '6–8' },
  { value: '9–12', label: '9–12' },
  { value: '13–17', label: '13–17' },
  { value: '18+', label: '18+' },
]

const EXPERIENCE_OPTIONS = [
  { value: 'Brand new', label: 'Brand new' },
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
]

const LESSON_FORMAT_OPTIONS = [
  { value: 'In person', label: 'In person' },
  { value: 'Online', label: 'Online' },
  { value: 'Either', label: 'Either' },
]

const INSTRUMENT_OPTIONS = [
  { value: 'Piano', label: 'Piano' },
  { value: 'Voice', label: 'Voice' },
  { value: 'Guitar', label: 'Guitar' },
  { value: 'Violin', label: 'Violin' },
  { value: 'Viola', label: 'Viola' },
  { value: 'Cello', label: 'Cello' },
  { value: 'Bass', label: 'Bass' },
  { value: 'Drums', label: 'Drums' },
  { value: 'Flute', label: 'Flute' },
  { value: 'Clarinet', label: 'Clarinet' },
  { value: 'Saxophone', label: 'Saxophone' },
  { value: 'Trumpet', label: 'Trumpet' },
  { value: 'Trombone', label: 'Trombone' },
  { value: 'Ukulele', label: 'Ukulele' },
  { value: 'Composition', label: 'Composition' },
  { value: 'Music Theory', label: 'Music Theory' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function matchesInstrument(profile: DirectoryTeacher, filter: string): boolean {
  if (filter === 'All') return true
  const instruments = profile.instruments ?? []
  return instruments.some((i) => i.toLowerCase() === filter.toLowerCase())
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FamilyDirectory() {
  const { toast } = useToast()

  // Data
  const [profiles, setProfiles] = useState<DirectoryTeacher[]>([])
  const [household, setHousehold] = useState<FamilyHousehold | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [activeInstrument, setActiveInstrument] = useState<string>('All')

  // Inquiry modal
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<DirectoryTeacher | null>(null)
  const [sending, setSending] = useState(false)

  // Form fields
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [studentFirstName, setStudentFirstName] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [instrument, setInstrument] = useState('')
  const [experience, setExperience] = useState('')
  const [lessonFormat, setLessonFormat] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [goals, setGoals] = useState('')

  // ── Fetch published directory profiles ──────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getDirectoryTeachers(),
      getMyHousehold(),
    ]).then(([teachers, hh]) => {
      setProfiles(teachers)
      setHousehold(hh)
    }).catch(() => setProfiles([]))
      .finally(() => setLoading(false))
  }, [])

  // ── Filtered & searched profiles ───────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = profiles

    // Instrument filter
    result = result.filter((p) => matchesInstrument(p, activeInstrument))

    // Search: name, city, instruments, studio
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((p) => {
        const name = (p.display_name ?? '').toLowerCase()
        const cityName = (p.city ?? '').toLowerCase()
        const instruments = (p.instruments ?? []).join(' ').toLowerCase()
        return `${name} ${cityName} ${instruments}`.includes(q)
      })
    }

    return result
  }, [profiles, activeInstrument, searchQuery])

  // ── Modal helpers ───────────────────────────────────────────────────────────

  function openInquiry(teacher: DirectoryTeacher) {
    setSelectedTeacher(teacher)
    // Pre-fill instrument if teacher has only one
    const teacherInstruments = teacher.instruments ?? []
    setInstrument(teacherInstruments.length === 1 ? teacherInstruments[0] : '')
    setGuardianName('')
    setGuardianEmail('')
    setStudentFirstName('')
    setAgeRange('')
    setExperience('')
    setLessonFormat('')
    setCity('')
    setState('')
    setGoals('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedTeacher(null)
  }

  async function handleSubmitInquiry(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTeacher || sending) return

    setSending(true)
    try {
      await sendDirectoryInquiry({
        to_teacher_user_id: selectedTeacher.user_id,
        from_household_id: household?.id ?? 'd6e35761-2df1-4a06-bc42-4caba67d02ba',
        prospective_student: {
          name: studentFirstName,
          age_range: ageRange,
          instrument: instrument,
          skill_level: experience,
          goals: goals,
          preferred_format: lessonFormat,
          city: city,
          state: state,
        },
        message: `Guardian: ${guardianName} (${guardianEmail})`,
      })
      toast('Inquiry sent! The teacher will be in touch.', 'success')
      closeModal()
    } catch {
      toast('Failed to send inquiry. Please try again.', 'error')
    } finally {
      setSending(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Find a Teacher"
        subtitle="Browse verified music teachers in your area"
      />

      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name, city, or instrument…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Instrument filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {INSTRUMENT_FILTERS.map((label) => (
          <button
            key={label}
            onClick={() => setActiveInstrument(label)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              activeInstrument === label
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {label !== 'All' && <Music className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
        <button
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-600"
        >
          <Filter className="h-3.5 w-3.5" />
          More filters
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading teachers…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={profiles.length === 0 ? 'No teachers available yet' : 'No matching teachers'}
          description={
            profiles.length === 0
              ? 'Check back soon as more teachers join the directory.'
              : 'Try adjusting your search or instrument filter.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((teacher) => (
            <Card key={teacher.id} className="flex flex-col">
              <CardContent className="flex flex-col flex-1 p-5">
                {/* Header: avatar + name + verified */}
                <div className="flex items-start gap-3 mb-3">
                  {teacher.profile_photo_url ? (
                    <img
                      src={teacher.profile_photo_url}
                      alt={teacher.display_name}
                      className="h-16 w-16 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                      {initials(teacher.display_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900 truncate">
                      {teacher.display_name}
                    </h3>
                    {teacher.is_verified && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs font-medium text-indigo-600">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verified
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                {(teacher.city || teacher.state) && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {[teacher.city, teacher.state].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}

                {/* Instruments tags */}
                {(teacher.instruments ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(teacher.instruments ?? []).map((inst) => (
                      <Badge key={inst} variant="teal" className="text-xs">
                        {inst}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Ages taught */}
                {(teacher.ages_taught ?? []).length > 0 && (
                  <p className="text-xs text-slate-500 mb-1">
                    Ages: {teacher.ages_taught.join(' · ')}
                  </p>
                )}

                {/* Lesson formats */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  {teacher.lesson_formats && teacher.lesson_formats.length > 0 ? (
                    teacher.lesson_formats.map((f: string) => f === 'in_person' ? 'In person' : f === 'online' ? 'Online' : 'Either').join(' · ')
                  ) : (
                    <span>Contact for formats</span>
                  )}
                </div>

                {/* Bio */}
                {teacher.bio && (
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">
                    {teacher.bio}
                  </p>
                )}

                {/* Spacer if no bio */}
                {!teacher.bio && <div className="flex-1" />}

                {/* Contact button */}
                <Button
                  variant="outline"
                  className="w-full border-blue-200 text-blue-800 hover:bg-blue-50 hover:text-blue-900 mt-auto"
                  onClick={() => openInquiry(teacher)}
                >
                  <Mail className="h-4 w-4" />
                  Contact
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Inquiry Modal ──────────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={closeModal} title={`Contact ${selectedTeacher?.display_name ?? ''}`}>
        <form onSubmit={handleSubmitInquiry} className="space-y-4">
          {/* Guardian info */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Name *</label>
            <Input
              required
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Email *</label>
            <Input
              required
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>

          <hr className="border-slate-100" />

          {/* Student info */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Student First Name *</label>
            <Input
              required
              maxLength={80}
              value={studentFirstName}
              onChange={(e) => setStudentFirstName(e.target.value)}
              placeholder="Alex"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Age Range</label>
              <Select
                options={AGE_RANGE_OPTIONS}
                placeholder="Select age…"
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instrument *</label>
              <Select
                required
                options={INSTRUMENT_OPTIONS}
                placeholder="Select…"
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Experience</label>
              <Select
                options={EXPERIENCE_OPTIONS}
                placeholder="Select…"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lesson Format</label>
              <Select
                options={LESSON_FORMAT_OPTIONS}
                placeholder="Select…"
                value={lessonFormat}
                onChange={(e) => setLessonFormat(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Goals</label>
            <textarea
              maxLength={1000}
              rows={3}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="What are your goals for lessons?"
              className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{goals.length}/1000</p>
          </div>

          {/* Privacy notice */}
          <p className="text-xs text-slate-500">
            By sending this inquiry, you agree to share your contact information with {selectedTeacher?.display_name ?? 'this teacher'}. 
            We respect your privacy and will not share your information beyond this inquiry.
          </p>

          {/* Submit */}
          <Button
            type="submit"
            disabled={sending}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
          >
            {sending ? 'Sending…' : 'Send Inquiry'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
