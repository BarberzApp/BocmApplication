// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Check for required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? 'present' : 'missing',
    anonKey: supabaseAnonKey ? 'present' : 'missing'
  });
  
  if (__DEV__) {
    throw new Error('Missing Supabase environment variables');
  }
}

// Create Supabase client with React Native AsyncStorage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});