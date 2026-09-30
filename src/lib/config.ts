export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  geminiApiKey: string
  aiApiKey: string
}

const DEFAULT_SUPABASE_URL = 'https://xznolrddcddcjynaavxe.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6bm9scmRkY2RkY2p5bmFhdnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyODQ4MzksImV4cCI6MjEwMjg2MDgzOX0.aDZWRC621kY6xhmHJl3QmyPv3Mgx6dSLTrQBNx0ydnk'

export function getConfig(): AppConfig {
  const localKey = (localStorage.getItem('STUDY_AI_API_KEY') || localStorage.getItem('STUDY_GEMINI_API_KEY') || '').trim()
  const envKey = (import.meta.env.VITE_AI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '').trim()
  const activeKey = localKey || envKey

  const localSupabaseUrl = (localStorage.getItem('STUDY_SUPABASE_URL') || '').trim()
  const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const activeSupabaseUrl = localSupabaseUrl || envSupabaseUrl || DEFAULT_SUPABASE_URL

  const localSupabaseKey = (localStorage.getItem('STUDY_SUPABASE_ANON_KEY') || '').trim()
  const envSupabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  const activeSupabaseKey = localSupabaseKey || envSupabaseKey || DEFAULT_SUPABASE_ANON_KEY

  return {
    supabaseUrl: activeSupabaseUrl,
    supabaseAnonKey: activeSupabaseKey,
    geminiApiKey: activeKey,
    aiApiKey: activeKey,
  }
}

export function setConfig(config: Partial<AppConfig>) {
  if (config.supabaseUrl !== undefined) {
    localStorage.setItem('STUDY_SUPABASE_URL', config.supabaseUrl)
  }
  if (config.supabaseAnonKey !== undefined) {
    localStorage.setItem('STUDY_SUPABASE_ANON_KEY', config.supabaseAnonKey)
  }
  if (config.geminiApiKey !== undefined) {
    localStorage.setItem('STUDY_GEMINI_API_KEY', config.geminiApiKey)
    localStorage.setItem('STUDY_AI_API_KEY', config.geminiApiKey)
  }
  if (config.aiApiKey !== undefined) {
    localStorage.setItem('STUDY_AI_API_KEY', config.aiApiKey)
    localStorage.setItem('STUDY_GEMINI_API_KEY', config.aiApiKey)
  }
}

export function clearConfig() {
  localStorage.removeItem('STUDY_SUPABASE_URL')
  localStorage.removeItem('STUDY_SUPABASE_ANON_KEY')
  localStorage.removeItem('STUDY_GEMINI_API_KEY')
  localStorage.removeItem('STUDY_AI_API_KEY')
}

export function isConfigValid(): boolean {
  const cfg = getConfig()
  return !!cfg.supabaseUrl && !!cfg.supabaseAnonKey && !!cfg.aiApiKey
}
