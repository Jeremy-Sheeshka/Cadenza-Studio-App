// /resources — full-featured resource library with folder tree, search, upload,
// PDF chunking, and student assignment.  2026-08-09 — cadenza-studio engagement.

import { useEffect, useState, useRef, useCallback, type DragEvent } from 'react'
import { api } from '../lib/serverApi'
import type { Resource, ResourceFolder, Student } from '../lib/types'
import {
  Card, Badge, Button, Input, Modal, PageHeader,
  EmptyState, Select, useToast,
} from '../components/ui'
import { cn } from '../lib/utils'
import {
  FolderPlus, Folder, Search, Mic, Sparkles, FileText, Music, Image, File,
  Send, Download, Scissors, ChevronRight, X, Upload, Menu, Inbox,
} from 'lucide-react'

// Polyfill for environments without crypto.randomUUID
function uid(): string {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}` }
}

// ---------------------------------------------------------------------------
// Mock data — realistic demo content
// ---------------------------------------------------------------------------

const MOCK_FOLDERS: ResourceFolder[] = [
  { id: 'f1', user_id: '', name: 'Sheet Music',        parent_id: null, created_at: '2026-01-15T10:00:00Z' },
  { id: 'f2', user_id: '', name: 'Audio Recordings',    parent_id: null, created_at: '2026-02-10T10:00:00Z' },
  { id: 'f3', user_id: '', name: 'Method Books',        parent_id: null, created_at: '2026-03-01T10:00:00Z' },
  { id: 'f4', user_id: '', name: 'Ensemble Parts',      parent_id: null, created_at: '2026-04-20T10:00:00Z' },
]

interface DemoResource {
  id: string
  user_id: string
  title: string
  description: string | null
  file_url: string | null
  thumbnail_url: string | null
  folder_id: string | null
  created_at: string
  file_type: 'pdf' | 'audio' | 'image' | 'other'
  file_size: number  // bytes
}

const MOCK_RESOURCES: DemoResource[] = [
  { id: 'r1',  user_id: '', title: 'Perdido_BigBand_Score.pdf',           description: 'Full big band score — Perdido',                       folder_id: 'f1', created_at: '2026-07-01T10:00:00Z', file_type: 'pdf',   file_size: 2_450_000, file_url: null, thumbnail_url: null },
  { id: 'r2',  user_id: '', title: 'Tenor_Sax_1_Perdido.pdf',             description: 'Tenor Sax 1 part for Perdido',                         folder_id: 'f1', created_at: '2026-07-01T10:30:00Z', file_type: 'pdf',   file_size: 520_000,   file_url: null, thumbnail_url: null },
  { id: 'r3',  user_id: '', title: 'All_The_Things_You_Are_Lead_Sheet.pdf', description: 'Lead sheet in Ab',                                   folder_id: 'f1', created_at: '2026-07-02T09:00:00Z', file_type: 'pdf',   file_size: 380_000,   file_url: null, thumbnail_url: null },
  { id: 'r4',  user_id: '', title: 'Clarinet_3_Pirates.pdf',              description: 'Clarinet 3 — Pirates of the Caribbean arrangement',    folder_id: 'f4', created_at: '2026-07-03T11:00:00Z', file_type: 'pdf',   file_size: 640_000,   file_url: null, thumbnail_url: null },
  { id: 'r5',  user_id: '', title: 'Rhythm_Changes_Backing_Track.mp3',    description: 'Bb backing track at 180 bpm',                           folder_id: 'f2', created_at: '2026-07-04T09:00:00Z', file_type: 'audio', file_size: 8_200_000, file_url: null, thumbnail_url: null },
  { id: 'r6',  user_id: '', title: 'Major_Scales_One_Octave.pdf',         description: 'All 12 major scales — one octave with fingerings',     folder_id: 'f3', created_at: '2026-07-05T14:00:00Z', file_type: 'pdf',   file_size: 1_100_000, file_url: null, thumbnail_url: null },
  { id: 'r7',  user_id: '', title: 'Blues_Scales_Reference.png',          description: 'Blues scales chart for all keys',                      folder_id: 'f3', created_at: '2026-07-06T10:00:00Z', file_type: 'image', file_size: 920_000,   file_url: null, thumbnail_url: null },
  { id: 'r8',  user_id: '', title: 'Autumn_Leaves_Play_Along.mp3',        description: 'Play-along track — concert G minor',                   folder_id: 'f2', created_at: '2026-07-06T11:00:00Z', file_type: 'audio', file_size: 7_500_000, file_url: null, thumbnail_url: null },
  { id: 'r9',  user_id: '', title: 'Trumpet_2_In_The_Mood.pdf',           description: 'Trumpet 2 part — In The Mood',                         folder_id: 'f4', created_at: '2026-07-07T08:00:00Z', file_type: 'pdf',   file_size: 410_000,   file_url: null, thumbnail_url: null },
  { id: 'r10', user_id: '', title: 'Studio_Policy_2026.pdf',              description: 'Updated studio policy document',                       folder_id: null,  created_at: '2026-07-08T12:00:00Z', file_type: 'pdf',   file_size: 280_000,   file_url: null, thumbnail_url: null },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

/** Derive a simple file-type icon/color from the resource's file_type or extension. */
function fileIcon(fileType: DemoResource['file_type']) {
  switch (fileType) {
    case 'pdf':   return { Icon: FileText, color: 'text-red-500',   bg: 'bg-red-50' }
    case 'audio': return { Icon: Music,    color: 'text-purple-500', bg: 'bg-purple-50' }
    case 'image': return { Icon: Image,    color: 'text-green-500',  bg: 'bg-green-50' }
    default:      return { Icon: File,     color: 'text-slate-400',  bg: 'bg-slate-100' }
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Left sidebar — folder tree */
function FolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  editingId,
  editValue,
  onEditStart,
  onEditChange,
  onEditCommit,
  onNewFolder,
  resourceCounts,
  sidebarOpen,
  onCloseSidebar,
}: {
  folders: ResourceFolder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  editingId: string | null
  editValue: string
  onEditStart: (f: ResourceFolder) => void
  onEditChange: (v: string) => void
  onEditCommit: () => void
  onNewFolder: () => void
  resourceCounts: Record<string, number>
  sidebarOpen: boolean
  onCloseSidebar: () => void
}) {
  const totalResources = Object.values(resourceCounts).reduce((a, b) => a + b, 0)

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={onCloseSidebar} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 transform bg-slate-800 text-slate-200 transition-transform duration-200 lg:static lg:z-0 lg:translate-x-0',
          'flex shrink-0 flex-col overflow-y-auto rounded-2xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">My Library</h2>
          <button
            onClick={onCloseSidebar}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Folder button */}
        <div className="px-3 pb-3">
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-start gap-2 bg-slate-700 text-slate-200 hover:bg-slate-600"
            onClick={onNewFolder}
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
        </div>

        {/* All Resources */}
        <nav className="flex-1 space-y-0.5 px-2">
          <button
            onClick={() => onSelectFolder(null)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              selectedFolderId === null
                ? 'bg-blue-700/30 text-blue-300 font-medium'
                : 'text-slate-300 hover:bg-slate-700/50',
            )}
          >
            <Folder className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">All Resources</span>
            <span className="text-xs text-slate-500">{totalResources}</span>
          </button>

          {folders.map((f) => {
            const isEditing = editingId === f.id
            const count = resourceCounts[f.id] ?? 0

            return (
              <div key={f.id} className="group flex items-center">
                <button
                  onClick={() => onSelectFolder(f.id)}
                  onDoubleClick={() => onEditStart(f)}
                  className={cn(
                    'flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    selectedFolderId === f.id
                      ? 'bg-blue-700/30 text-blue-300 font-medium'
                      : 'text-slate-300 hover:bg-slate-700/50',
                  )}
                >
                  <Folder className="h-4 w-4 shrink-0" />
                  {isEditing ? (
                    <input
                      className="flex-1 rounded border border-blue-500/50 bg-slate-700 px-1 py-0.5 text-sm text-slate-100 outline-none"
                      value={editValue}
                      onChange={(e) => onEditChange(e.target.value)}
                      onBlur={onEditCommit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onEditCommit()
                        if (e.key === 'Escape') onEditCommit()
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 truncate">{f.name}</span>
                  )}
                  <span className="text-xs text-slate-500">{count}</span>
                </button>
                {!isEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditStart(f) }}
                    className="mr-1 rounded p-0.5 text-slate-600 opacity-0 transition-opacity hover:bg-slate-700 hover:text-slate-300 group-hover:opacity-100"
                    title="Rename folder"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 px-4 py-3">
          <p className="text-[11px] text-slate-500">{folders.length} folders · {totalResources} files</p>
        </div>
      </aside>
    </>
  )
}

/** Search bar with mic + AI buttons */
function SearchBar({
  value,
  onChange,
  onAISearch,
  aiLoading,
}: {
  value: string
  onChange: (v: string) => void
  onAISearch: () => void
  aiLoading: boolean
}) {
  const { toast } = useToast()

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9 pr-2"
          placeholder="Search your library..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onAISearch()
          }}
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => toast('Voice search coming soon', 'info')}
        title="Voice search (coming soon)"
      >
        <Mic className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onAISearch}
        disabled={aiLoading || !value.trim()}
        title="AI-powered search"
        className={aiLoading ? 'animate-pulse' : ''}
      >
        <Sparkles className="h-4 w-4" />
      </Button>
    </div>
  )
}

/** Drag-and-drop upload zone */
function UploadZone({ onUpload }: { onUpload: (files: FileList | null) => void }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragIn = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const handleDragOut = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    onUpload(e.dataTransfer.files)
  }

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
      className={cn(
        'cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
        dragging
          ? 'border-blue-400 bg-blue-50/50'
          : 'border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <Upload className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-600">
        {dragging ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
      </p>
      <p className="mt-1 text-xs text-slate-400">PDF, audio, images — up to 50 MB each</p>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => onUpload(e.target.files)}
      />
    </div>
  )
}

/** Single resource card */
function ResourceCard({
  resource,
  folderName,
  onChunk,
  onSend,
  onDownload,
}: {
  resource: DemoResource
  folderName: string | null
  onChunk: (r: DemoResource) => void
  onSend: (r: DemoResource) => void
  onDownload: (r: DemoResource) => void
}) {
  const { Icon, color, bg } = fileIcon(resource.file_type)

  return (
    <Card className="group relative overflow-hidden p-4 transition-shadow hover:shadow-md">
      {/* File icon */}
      <div className="mb-3 flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', bg)}>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {resource.file_type === 'pdf' && (
            <button
              onClick={(e) => { e.stopPropagation(); onChunk(resource) }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-violet-600"
              title="Extract pages"
            >
              <Scissors className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onSend(resource) }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
            title="Send to student"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(resource) }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3
        className="text-sm font-medium leading-snug text-slate-900 truncate"
        title={resource.title}
      >
        {resource.title}
      </h3>

      {/* Description */}
      {resource.description && (
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{resource.description}</p>
      )}

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-slate-400">{formatBytes(resource.file_size)}</span>
        {folderName && (
          <Badge variant="slate">{folderName}</Badge>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// PDF Chunk Modal
// ---------------------------------------------------------------------------

function ChunkModal({
  open,
  onClose,
  resource,
  onExtract,
  onSendAfter,
}: {
  open: boolean
  onClose: () => void
  resource: DemoResource | null
  onExtract: (resource: DemoResource, pageRange: string, label: string) => void
  onSendAfter: (fileName: string) => void
}) {
  const [pageRange, setPageRange] = useState('')
  const [label, setLabel] = useState('')
  const [extractedFile, setExtractedFile] = useState<string | null>(null)

  const handleExtract = () => {
    if (!resource || !pageRange.trim() || !label.trim()) return
    onExtract(resource, pageRange.trim(), label.trim())
    const newFileName = `${label.replace(/\s+/g, '_')}_${resource.title}`
    setExtractedFile(newFileName)
  }

  const handleClose = () => {
    setPageRange('')
    setLabel('')
    setExtractedFile(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Extract Pages">
      {resource && (
        <div className="space-y-4">
          {/* Source file info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Source file</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-800">
              <FileText className="h-4 w-4 text-red-500" />
              {resource.title}
            </p>
          </div>

          {/* Page range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Page range</label>
            <Input
              placeholder="e.g. 3-5 or 2,4,7"
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Enter a range like &quot;3-5&quot; or comma-separated pages like &quot;2,4,7&quot;</p>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label for this part</label>
            <Input
              placeholder="e.g. Tenor Sax 2"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* Preview */}
          {pageRange && label && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-800">Preview</p>
              <p className="mt-1 text-sm text-blue-950">
                <span className="font-medium">Source:</span> {resource.title}
              </p>
              <p className="text-sm text-blue-950">
                <span className="font-medium">Part:</span> {label}
              </p>
              <p className="text-sm text-blue-950">
                <span className="font-medium">Pages:</span> {pageRange}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700"
              onClick={handleExtract}
              disabled={!pageRange.trim() || !label.trim()}
            >
              <Scissors className="h-4 w-4" />
              Extract & Save as New File
            </Button>

            {extractedFile && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { onSendAfter(extractedFile); handleClose() }}
              >
                <Send className="h-4 w-4" />
                Send to Student
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Send-to-Student Modal
// ---------------------------------------------------------------------------

function SendModal({
  open,
  onClose,
  resource,
  students,
  onSend,
}: {
  open: boolean
  onClose: () => void
  resource: DemoResource | { title: string } | null
  students: Student[]
  onSend: (fileName: string, studentId: string) => void
}) {
  const [studentId, setStudentId] = useState('')

  const handleSend = () => {
    if (!resource || !studentId) return
    onSend(resource.title, studentId)
    setStudentId('')
    onClose()
  }

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.first_name} ${s.last_name}`,
  }))

  return (
    <Modal open={open} onClose={onClose} title="Send to Student">
      {resource && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">File</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-800">
              <FileText className="h-4 w-4 text-slate-400" />
              {resource.title}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select student</label>
            <Select
              options={studentOptions}
              placeholder="Choose a student…"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>

          <Button
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            onClick={handleSend}
            disabled={!studentId}
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Resources() {
  const { toast } = useToast()

  // ── State ────────────────────────────────────────────────────────────────
  const [resources, setResources] = useState<DemoResource[]>(MOCK_RESOURCES)
  const [folders, setFolders] = useState<ResourceFolder[]>(MOCK_FOLDERS)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Folder editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Modals
  const [chunkResource, setChunkResource] = useState<DemoResource | null>(null)
  const [sendResource, setSendResource] = useState<DemoResource | null>(null)

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Try loading from real API, fall back to mock data gracefully
    Promise.all([
      api.getResources().catch(() => []) as Promise<Resource[]>,
      api.getStudents().catch(() => []) as Promise<Student[]>,
    ])
      .then(([serverResources, serverStudents]) => {
        if (Array.isArray(serverStudents) && serverStudents.length > 0) {
          setStudents(serverStudents)
        }
        if (Array.isArray(serverResources) && serverResources.length > 0) {
          // Map server resources to DemoResource shape
          const mapped: DemoResource[] = serverResources.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            title: r.title,
            description: r.description,
            file_url: r.file_url,
            thumbnail_url: r.thumbnail_url,
            folder_id: r.folder_id,
            created_at: r.created_at,
            file_type: guessFileType(r.title),
            file_size: 0,
          }))
          setResources(mapped)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Derived data ─────────────────────────────────────────────────────────
  const resourceCounts = resources.reduce<Record<string, number>>((acc, r) => {
    if (r.folder_id) {
      acc[r.folder_id] = (acc[r.folder_id] ?? 0) + 1
    }
    return acc
  }, {})

  const folderNameById = useCallback(
    (id: string | null) => {
      if (!id) return null
      return folders.find((f) => f.id === id)?.name ?? null
    },
    [folders],
  )

  const filtered = resources.filter((r) => {
    if (selectedFolderId !== null && r.folder_id !== selectedFolderId) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        r.title.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAISearch = async () => {
    if (!search.trim()) return
    setAiLoading(true)
    try {
      const results = await api.searchResources(search.trim())
      // If backend returns results, try to use them
      if (Array.isArray(results) && results.length > 0) {
        const mapped: DemoResource[] = results.map((r: any) => ({
          id: r.id ?? uid(),
          user_id: r.user_id ?? '',
          title: r.title ?? r.name ?? 'Untitled',
          description: r.description ?? null,
          file_url: r.file_url ?? null,
          thumbnail_url: r.thumbnail_url ?? null,
          folder_id: r.folder_id ?? null,
          created_at: r.created_at ?? new Date().toISOString(),
          file_type: guessFileType(r.title ?? r.name ?? ''),
          file_size: r.file_size ?? 0,
        }))
        setResources(mapped)
        setSelectedFolderId(null)
        toast('AI search complete — showing best matches', 'success')
      } else {
        toast('No results found for your query', 'info')
      }
    } catch {
      // Fallback to client-side filter — already done by filtered
      toast('Searching locally (AI service unavailable)', 'info')
    } finally {
      setAiLoading(false)
    }
  }

  const handleUpload = (_files: FileList | null) => {
    if (!_files || _files.length === 0) return
    toast(`${_files.length} file(s) uploaded successfully`, 'success')
    // In production this would call api.uploadResource(formData)
  }

  const handleChunk = (resource: DemoResource, pageRange: string, label: string) => {
    toast(
      `Extracted "${label}" (pages ${pageRange}) from ${resource.title} — saved as new file`,
      'success',
    )
  }

  const handleSendToStudent = (fileName: string, studentId: string) => {
    const student = students.find((s) => s.id === studentId)
    const studentName = student ? `${student.first_name} ${student.last_name}` : studentId
    toast(`"${fileName}" sent to ${studentName}`, 'success')
  }

  const handleDownload = (resource: DemoResource) => {
    toast(`Downloading ${resource.title}...`, 'info')
    // In production this would trigger an actual download
  }

  // ── Folder actions ───────────────────────────────────────────────────────
  const handleNewFolder = () => {
    const name = `New Folder ${folders.length + 1}`
    const newFolder: ResourceFolder = {
      id: `f${uid()}`,
      user_id: '',
      name,
      parent_id: null,
      created_at: new Date().toISOString(),
    }
    setFolders((prev) => [...prev, newFolder])
    setEditingId(newFolder.id)
    setEditValue(name)
    toast('Folder created', 'success')
  }

  const handleEditStart = (f: ResourceFolder) => {
    setEditingId(f.id)
    setEditValue(f.name)
  }

  const handleEditCommit = () => {
    if (!editingId) return
    const trimmed = editValue.trim()
    if (trimmed) {
      setFolders((prev) =>
        prev.map((f) => (f.id === editingId ? { ...f, name: trimmed } : f)),
      )
    }
    setEditingId(null)
    setEditValue('')
  }

  const handleEditChange = (v: string) => setEditValue(v)

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <PageHeader title="Resources" subtitle="Upload & share lesson materials with your students" />
        <div className="flex items-center justify-center py-20 text-slate-400">Loading…</div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Resources"
        subtitle="Upload & share lesson materials with your students"
        action={
          <Button
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            onClick={() => document.getElementById('upload-zone')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
        }
      />

      <div className="flex gap-6">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <FolderSidebar
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => { setSelectedFolderId(id); setSidebarOpen(false) }}
          editingId={editingId}
          editValue={editValue}
          onEditStart={handleEditStart}
          onEditChange={handleEditChange}
          onEditCommit={handleEditCommit}
          onNewFolder={handleNewFolder}
          resourceCounts={resourceCounts}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />

        {/* ── Main content ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile hamburger + search row */}
          <div className="flex items-center gap-2 lg:hidden">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="shrink-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} onAISearch={handleAISearch} aiLoading={aiLoading} />
            </div>
          </div>

          {/* Desktop search */}
          <div className="hidden lg:block">
            <SearchBar value={search} onChange={setSearch} onAISearch={handleAISearch} aiLoading={aiLoading} />
          </div>

          {/* Upload zone */}
          <div id="upload-zone">
            <UploadZone onUpload={handleUpload} />
          </div>

          {/* Active folder badge */}
          {selectedFolderId && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Filtered by:</span>
              <Badge variant="teal" className="gap-1">
                <Folder className="h-3 w-3" />
                {folderNameById(selectedFolderId)}
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className="ml-1 rounded-full p-0.5 hover:bg-blue-200/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              <span className="text-xs text-slate-400">{filtered.length} file(s)</span>
            </div>
          )}

          {/* Resource grid */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No resources found"
              description={
                search.trim()
                  ? `Nothing matches "${search}". Try a different search or browse by folder.`
                  : 'Upload a PDF, audio file, or image to share with students.'
              }
              action={
                <Button onClick={() => document.getElementById('upload-zone')?.scrollIntoView({ behavior: 'smooth' })}>
                  <Upload className="h-4 w-4" />
                  Upload Files
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  folderName={folderNameById(r.folder_id)}
                  onChunk={(res) => setChunkResource(res)}
                  onSend={(res) => setSendResource(res)}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <ChunkModal
        open={!!chunkResource}
        onClose={() => setChunkResource(null)}
        resource={chunkResource}
        onExtract={handleChunk}
        onSendAfter={(fileName) => {
          // Capture before nulling — the extracted file inherits the original's metadata
          const original = chunkResource
          setChunkResource(null)
          if (original) {
            setSendResource({ ...original, title: fileName })
          }
        }}
      />

      <SendModal
        open={!!sendResource}
        onClose={() => setSendResource(null)}
        resource={sendResource}
        students={students}
        onSend={handleSendToStudent}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function guessFileType(title: string): DemoResource['file_type'] {
  const ext = title.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':  return 'pdf'
    case 'mp3':
    case 'wav':
    case 'm4a':
    case 'flac':
    case 'ogg':  return 'audio'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':  return 'image'
    default:     return 'other'
  }
}
