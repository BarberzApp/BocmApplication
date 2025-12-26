/**
 * Simple logger utility
 * Disabled in production, enabled in development
 */
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production'

type LogLevel = 'log' | 'error' | 'warn' | 'info' | 'debug'

class Logger {
  private shouldLog(level: LogLevel): boolean {
    // Always log errors
    if (level === 'error') return true
    // In development, log everything
    return isDev
  }

  log(...args: unknown[]): void {
    if (this.shouldLog('log')) {
      console.log(...args)
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(...args)
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...args)
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(...args)
    }
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(...args)
    }
  }
}

export const logger = new Logger()

