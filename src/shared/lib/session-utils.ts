import { supabase } from './supabase'
import { useAuthStore } from '@/shared/stores/auth-store'
import { logger } from './logger'

export interface SessionValidationResult {
  isValid: boolean
  session?: any
  error?: string
  needsRefresh?: boolean
}

/**
 * Validates and optionally refreshes the current session
 * @param autoRefresh Whether to automatically refresh if session is expiring soon
 * @returns SessionValidationResult with validation status
 */
export async function validateSession(autoRefresh: boolean = true): Promise<SessionValidationResult> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      logger.error('Session validation error', sessionError)
      return {
        isValid: false,
        error: sessionError.message
      }
    }
    
    if (!session) {
      return {
        isValid: false,
        error: 'No active session found'
      }
    }
    
    // Check if session is about to expire (within 5 minutes)
    const expiresAt = session.expires_at
    const now = Math.floor(Date.now() / 1000)
    const fiveMinutes = 5 * 60
    
    if (expiresAt && (expiresAt - now) < fiveMinutes) {
      logger.debug('Session expiring soon, refreshing')
      
      if (autoRefresh) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          logger.warn('Session refresh warning', refreshError)
          // Don't fail for refresh errors, continue with current session
          return {
            isValid: true,
            session,
            needsRefresh: true
          }
        } else if (refreshedSession) {
          logger.debug('Session refreshed successfully')
          return {
            isValid: true,
            session: refreshedSession
          }
        }
      } else {
        return {
          isValid: true,
          session,
          needsRefresh: true
        }
      }
    }
    
    return {
      isValid: true,
      session
    }
  } catch (error) {
    logger.error('Error validating session', error)
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Attempts to recover a session by refreshing it
 * @param maxRetries Maximum number of retry attempts
 * @returns Promise<boolean> indicating if recovery was successful
 */
export async function attemptSessionRecovery(maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.debug(`Session recovery attempt ${attempt}/${maxRetries}`)
    
    try {
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        logger.error(`Recovery attempt ${attempt} failed`, refreshError)
        if (attempt === maxRetries) {
          return false
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        continue
      }
      
      if (session) {
        logger.debug('Session recovered successfully')
        return true
      } else {
        logger.debug(`Recovery attempt ${attempt}: No session after refresh`)
        if (attempt === maxRetries) {
          return false
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    } catch (error) {
      logger.error(`Recovery attempt ${attempt} exception`, error)
      if (attempt === maxRetries) {
        return false
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
  
  return false
}

/**
 * Checks if the current session is valid for Stripe Connect flows
 * @returns Promise<boolean> indicating if session is ready for Stripe Connect
 */
export async function isSessionReadyForStripeConnect(): Promise<boolean> {
  const result = await validateSession(true)
  
  if (!result.isValid) {
    logger.debug('Session not valid for Stripe Connect', { error: result.error })
    return false
  }
  
  if (result.needsRefresh) {
    logger.debug('Session needs refresh for Stripe Connect')
    return false
  }
  
  logger.debug('Session ready for Stripe Connect')
  return true
}

/**
 * Gets the current user ID from session, with validation
 * @returns Promise<string | null> user ID or null if not available
 */
export async function getCurrentUserId(): Promise<string | null> {
  const result = await validateSession(false)
  
  if (!result.isValid || !result.session) {
    return null
  }
  
  return result.session.user.id
}

/**
 * Ensures session is valid before making authenticated requests
 * @param callback Function to execute if session is valid
 * @returns Promise<T | null> result of callback or null if session invalid
 */
export async function withValidSession<T>(
  callback: (userId: string) => Promise<T>
): Promise<T | null> {
  const result = await validateSession(true)
  if (!result.isValid || !result.session) {
    // Trigger login modal via Zustand
    if (typeof window !== 'undefined') {
      const store = await import('@/shared/stores/auth-store')
      store.useAuthStore.getState().setShowLoginModal(true)
    }
    logger.debug('Session not valid for authenticated request', { error: result.error })
    return null
  }
  try {
    return await callback(result.session.user.id)
  } catch (error) {
    logger.error('Error in authenticated callback', error)
    return null
  }
} 