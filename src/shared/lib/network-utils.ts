import React from 'react'
import { supabase } from './supabase'
import { logger } from './logger'

// Network timeout configuration
const DEFAULT_TIMEOUT = 10000 // 10 seconds
const DEFAULT_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

// Custom error types
export class NetworkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timed out') {
    super(message)
    this.name = 'TimeoutError'
  }
}

// Timeout wrapper for promises
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new TimeoutError()), timeoutMs)
    )
  ])
}

// Retry wrapper with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_RETRIES,
  baseDelay: number = RETRY_DELAY
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on certain errors
      if (shouldNotRetry(error as Error)) {
        throw error
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error
      }

      // Wait before retrying (exponential backoff)
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

// Check if error should not be retried
function shouldNotRetry(error: Error): boolean {
  // Don't retry authentication errors
  if (error.message.includes('auth') || error.message.includes('session')) {
    return true
  }
  
  // Don't retry validation errors
  if (error.message.includes('validation') || error.message.includes('invalid')) {
    return true
  }
  
  // Don't retry permission errors
  if (error.message.includes('permission') || error.message.includes('forbidden')) {
    return true
  }

  return false
}

// Enhanced Supabase query wrapper
export async function safeSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: {
    timeout?: number
    retries?: number
    errorMessage?: string
  } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, errorMessage = 'Database query failed' } = options

  return withRetry(
    async () => {
      const result = await withTimeout(queryFn(), timeout)
      
      if (result.error) {
        throw new NetworkError(
          result.error.message || errorMessage,
          result.error.code,
          result.error.details
        )
      }
      
      if (result.data === null) {
        throw new NetworkError('No data returned from query')
      }
      
      return result.data
    },
    retries
  )
}

// Enhanced fetch wrapper
export async function safeFetch(
  url: string,
  options: RequestInit & {
    timeout?: number
    retries?: number
  } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, ...fetchOptions } = options

  return withRetry(
    async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new NetworkError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          )
        }

        return response
      } catch (error) {
        clearTimeout(timeoutId)
        
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TimeoutError()
        }
        
        throw error
      }
    },
    retries
  )
}

// Session-aware API call wrapper
export async function authenticatedApiCall<T>(
  apiCall: (userId: string) => Promise<T>,
  options: {
    timeout?: number
    retries?: number
    requireAuth?: boolean
  } = {}
): Promise<T | null> {
  const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, requireAuth = true } = options

  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      throw new NetworkError('Session error: ' + sessionError.message)
    }

    if (requireAuth && !session?.user) {
      throw new NetworkError('Authentication required')
    }

    if (!session?.user?.id) {
      throw new NetworkError('Invalid user session')
    }

    return await withRetry(
      async () => {
        return await withTimeout(apiCall(session.user.id), timeout)
      },
      retries
    )
  } catch (error) {
    logger.error('Authenticated API call failed', error)
    throw error
  }
}

// Network status monitoring
export class NetworkMonitor {
  private static instance: NetworkMonitor
  private isOnline: boolean = navigator.onLine
  private listeners: Set<(online: boolean) => void> = new Set()

  private constructor() {
    this.setupEventListeners()
  }

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor()
    }
    return NetworkMonitor.instance
  }

  private setupEventListeners() {
    window.addEventListener('online', () => this.updateStatus(true))
    window.addEventListener('offline', () => this.updateStatus(false))
  }

  private updateStatus(online: boolean) {
    this.isOnline = online
    this.listeners.forEach(listener => listener(online))
  }

  addListener(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  isNetworkOnline(): boolean {
    return this.isOnline
  }
}

// Hook for network status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    const monitor = NetworkMonitor.getInstance()
    setIsOnline(monitor.isNetworkOnline())
    
    const unsubscribe = monitor.addListener(setIsOnline)
    return unsubscribe
  }, [])

  return isOnline
}

// Utility for handling common Supabase errors
export function handleSupabaseError(error: any): string {
  if (!error) return 'An unknown error occurred'

  // Handle specific Supabase error codes
  switch (error.code) {
    case 'PGRST116':
      return 'Record not found'
    case '23505':
      return 'This record already exists'
    case '23503':
      return 'Referenced record does not exist'
    case '42P01':
      return 'Table does not exist'
    case '42501':
      return 'Insufficient permissions'
    case 'PGRST301':
      return 'JWT token expired'
    case 'PGRST302':
      return 'JWT token invalid'
    default:
      return error.message || 'Database operation failed'
  }
}

// Debounced function wrapper
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttled function wrapper
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
} 