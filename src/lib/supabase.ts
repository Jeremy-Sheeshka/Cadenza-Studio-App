// Transport factory: real Supabase client OR in-memory mock.
// The mock implements the exact query patterns the app uses (see api.ts), so
// the replica runs standalone for study without any backend.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createMockClient, type MockClient } from './mock'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const useMock = (import.meta.env.VITE_USE_MOCK ?? '1') === '1'

export const isMock = useMock || !url || !anon

export function getClient(): SupabaseClient | MockClient {
  if (isMock) return createMockClient()
  // Live mode — same shape as production (anon key lives in the bundle there too;
  // RLS is what protects the data, never the key).
  return createClient(url as string, anon as string, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
}
