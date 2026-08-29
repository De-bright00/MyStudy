import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getConfig } from './config'

let supabaseInstance: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = getConfig()
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
}

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = getConfig()
  return !!supabaseUrl && !!supabaseAnonKey
}
