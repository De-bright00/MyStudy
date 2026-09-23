export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  geminiApiKey: string
  aiApiKey: string
}

export function getConfig(): AppConfig {
  const envKey = (import.meta.env.VITE_AI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '').trim()
  const localKey = (localStorage.getItem('STUDY_AI_API_KEY') || localStorage.getItem('STUDY_GEMINI_API_KEY') || '').trim()
  const activeKey = envKey || localKey

  return {
    supabaseUrl: (localStorage.getItem('STUDY_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || '').trim(),
    supabaseAnonKey: (localStorage.getItem('STUDY_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim(),
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
