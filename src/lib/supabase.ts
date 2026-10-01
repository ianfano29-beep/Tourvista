import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://jwihlqtitbkxildfurbf.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aWhscXRpdGJreGlsZGZ1cmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzE2MTksImV4cCI6MjEwNjQwNzYxOX0.igNnmkEgpqRKqr2yBHyWoeLCCPl-tuil_YKFz607z0g'

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
