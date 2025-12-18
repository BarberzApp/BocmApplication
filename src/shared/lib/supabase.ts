import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Check for required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('Missing Supabase environment variables', undefined, {
    url: supabaseUrl ? 'present' : 'missing',
    anonKey: supabaseAnonKey ? 'present' : 'missing'
  })
  
  // In development, throw an error
  if (process.env.NODE_ENV === 'development') {
    throw new Error('Missing Supabase environment variables')
  }
}

// Create a single Supabase client instance for the entire app
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'barber-app-auth'
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'barber-app'
    }
  }
})

// Create a Supabase client with the service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
}) 