/**
 * Production-ready logger utility for Next.js web application
 * 
 * Features:
 * - Disables logging in production (except errors)
 * - Structured logging support
 * - Integration with Sentry error reporting
 * - Performance-safe (no-op in production)
 * 
 * Usage:
 *   import { logger } from '@/shared/lib/logger'
 *   logger.log('Debug message')
 *   logger.error('Error message', error)
 *   logger.warn('Warning message')
 */

import * as Sentry from '@sentry/nextjs'

type LogLevel = 'log' | 'error' | 'warn' | 'info' | 'debug'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isServer: boolean

  constructor() {
    // Check if we're on the server (Next.js)
    this.isServer = typeof window === 'undefined'
  }

  /**
   * Check if we're in development mode
   * Works in both server and client contexts
   */
  private get isDev(): boolean {
    // Server-side: check process.env.NODE_ENV
    if (this.isServer) {
      return process.env.NODE_ENV !== 'production'
    }
    
    // Client-side: check if we're in development
    // Next.js replaces process.env.NODE_ENV at build time
    // Fallback: check for development indicators
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV !== 'production'
    }
    
    // If we can't determine, assume production for safety
    return false
  }

  /**
   * Determine if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    // Always log errors (even in production)
    if (level === 'error') return true
    
    // In development, log everything
    if (this.isDev) return true
    
    // In production, only log errors
    return false
  }

  /**
   * Format log message with context
   */
  private formatMessage(message: string, context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return message
    }
    
    try {
      return `${message} ${JSON.stringify(context)}`
    } catch {
      return `${message} [Context serialization failed]`
    }
  }

  /**
   * Log a debug message (development only)
   */
  log(message: string, ...args: unknown[]): void {
    if (this.shouldLog('log')) {
      console.log(`[LOG] ${message}`, ...args)
    }
  }

  /**
   * Log an error (always logged, even in production)
   * Also sends to Sentry in production
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const formattedMessage = this.formatMessage(message, context)

    if (this.shouldLog('error')) {
      if (error instanceof Error) {
        console.error(`[ERROR] ${formattedMessage}`, error)
      } else if (error) {
        console.error(`[ERROR] ${formattedMessage}`, error)
      } else {
        console.error(`[ERROR] ${formattedMessage}`)
      }
    }

    // Send to Sentry in production
    if (!this.isDev && typeof window !== 'undefined') {
      // Client-side: use Sentry browser SDK
      try {
        if (error instanceof Error) {
          Sentry.captureException(error, {
            tags: {
              logger: true,
            },
            extra: context || {},
            contexts: {
              message: {
                message,
              },
            },
          })
        } else if (error) {
          Sentry.captureException(new Error(String(error)), {
            tags: {
              logger: true,
            },
            extra: {
              ...context,
              originalError: error,
            },
            contexts: {
              message: {
                message,
              },
            },
          })
        } else {
          Sentry.captureMessage(formattedMessage, {
            level: 'error',
            tags: {
              logger: true,
            },
            extra: context || {},
          })
        }
      } catch (sentryError) {
        // Silently fail if Sentry is not available
        console.error('Failed to send error to Sentry:', sentryError)
      }
    } else if (!this.isDev && this.isServer) {
      // Server-side: use Sentry Node SDK
      try {
        if (error instanceof Error) {
          Sentry.captureException(error, {
            tags: {
              logger: true,
            },
            extra: context || {},
            contexts: {
              message: {
                message,
              },
            },
          })
        } else if (error) {
          Sentry.captureException(new Error(String(error)), {
            tags: {
              logger: true,
            },
            extra: {
              ...context,
              originalError: error,
            },
            contexts: {
              message: {
                message,
              },
            },
          })
        } else {
          Sentry.captureMessage(formattedMessage, {
            level: 'error',
            tags: {
              logger: true,
            },
            extra: context || {},
          })
        }
      } catch (sentryError) {
        // Silently fail if Sentry is not available
        console.error('Failed to send error to Sentry:', sentryError)
      }
    }
  }

  /**
   * Log a warning (development only)
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  }

  /**
   * Log an info message (development only)
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args)
    }
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args)
    }
  }

  /**
   * Log with structured context (useful for analytics/debugging)
   */
  logWithContext(
    level: LogLevel,
    message: string,
    context: LogContext,
    error?: Error | unknown
  ): void {
    if (!this.shouldLog(level)) return

    const formattedMessage = this.formatMessage(message, {
      ...context,
      timestamp: new Date().toISOString(),
      environment: this.isDev ? 'development' : 'production',
      isServer: this.isServer,
    })

    switch (level) {
      case 'error':
        this.error(formattedMessage, error)
        break
      case 'warn':
        this.warn(formattedMessage)
        break
      case 'info':
        this.info(formattedMessage)
        break
      case 'debug':
        this.debug(formattedMessage)
        break
      default:
        this.log(formattedMessage)
    }
  }

  /**
   * Group related logs together (development only)
   */
  group(label: string, callback: () => void): void {
    if (this.isDev) {
      console.group(label)
      callback()
      console.groupEnd()
    } else {
      callback()
    }
  }

  /**
   * Time a function execution (development only)
   */
  time(label: string): void {
    if (this.isDev) {
      console.time(label)
    }
  }

  /**
   * End timing a function execution (development only)
   */
  timeEnd(label: string): void {
    if (this.isDev) {
      console.timeEnd(label)
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export type for TypeScript
export type { LogLevel, LogContext }

