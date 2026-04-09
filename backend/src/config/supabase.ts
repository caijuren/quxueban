import { createClient } from '@supabase/supabase-js'
import { env } from './env'

let supabaseInstance: ReturnType<typeof createClient> | null = null

if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
  supabaseInstance = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY
  )
}

export const supabase = supabaseInstance
