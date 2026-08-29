export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  geminiApiKey: string
}

export function getConfig(): AppConfig {
  return {
    supabaseUrl: localStorage.getItem('STUDY_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: localStorage.getItem('STUDY_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    geminiApiKey: localStorage.getItem('STUDY_GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '',
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
  }
}

export function clearConfig() {
  localStorage.removeItem('STUDY_SUPABASE_URL')
  localStorage.removeItem('STUDY_SUPABASE_ANON_KEY')
  localStorage.removeItem('STUDY_GEMINI_API_KEY')
}

export function isConfigValid(): boolean {
  const cfg = getConfig()
  return !!cfg.supabaseUrl && !!cfg.supabaseAnonKey && !!cfg.geminiApiKey
}
