import { createClient } from '@supabase/supabase-js'

// Public values (safe to ship in the browser). Override with env vars if needed.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://sepkrzmipcnbwmlalraf.supabase.co'
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_5V1ODuzdVCIc-lQ17e9rXg_PJ-4MaBH'

export const supabaseConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'))

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
)
