import { logger } from '../lib/logger'

interface ErrorReport {
  message: string
  stack?: string
  url?: string
  userAgent?: string
  userId?: string
  timestamp: string
  errorType: 'javascript' | 'react' | 'api' | 'network' | 'unhandled'
  componentStack?: string
  retryCount?: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

class ErrorReporter {
  private static instance: ErrorReporter
  private reportedErrors = new Set<string>()
  private reportQueue: ErrorReport[] = []
  private isReporting = false

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupGlobalErrorHandlers()
    }
  }

  private setupGlobalErrorHandlers() {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        errorType: 'javascript',
        severity: 'medium'
      })
    })

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        errorType: 'unhandled',
        severity: 'high'
      })
    })

    // Catch network errors (fetch failures)
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        if (!response.ok && response.status >= 500) {
          this.reportError({
            message: `Network error: ${response.status} ${response.statusText}`,
            url: args[0]?.toString(),
            errorType: 'network',
            severity: 'medium'
          })
        }
        return response
      } catch (error) {
        this.reportError({
          message: `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          stack: error instanceof Error ? error.stack : undefined,
          url: args[0]?.toString(),
          errorType: 'network',
          severity: 'high'
        })
        throw error
      }
    }
  }

  reportError(errorData: Partial<ErrorReport>) {
    const fullErrorData: ErrorReport = {
      message: errorData.message || 'Unknown error',
      stack: errorData.stack,
      url: errorData.url || (typeof window !== 'undefined' ? window.location.href : 'unknown'),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      userId: this.getCurrentUserId(),
      timestamp: new Date().toISOString(),
      errorType: errorData.errorType || 'javascript',
      componentStack: errorData.componentStack,
      retryCount: errorData.retryCount,
      severity: errorData.severity || 'medium'
    }

    // Create a unique key to prevent duplicate reports
    const errorKey = `${fullErrorData.message}-${fullErrorData.url}-${fullErrorData.errorType}`
    
    if (this.reportedErrors.has(errorKey)) {
      logger.debug('Error already reported, skipping', { errorKey })
      return
    }

    this.reportedErrors.add(errorKey)
    this.reportQueue.push(fullErrorData)
    
    // Process queue
    this.processReportQueue()
  }

  private async processReportQueue() {
    if (this.isReporting || this.reportQueue.length === 0) {
      return
    }

    this.isReporting = true

    while (this.reportQueue.length > 0) {
      const errorReport = this.reportQueue.shift()!
      
      try {
        await this.sendErrorReport(errorReport)
        logger.debug('Error reported successfully', { message: errorReport.message })
      } catch (error) {
        logger.error('Failed to report error', error)
        // Re-queue on failure (but only once)
        if (!errorReport.message.includes('RETRY')) {
          this.reportQueue.unshift({
            ...errorReport,
            message: `${errorReport.message} (RETRY)`
          })
        }
      }

      // Small delay between reports to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    this.isReporting = false
  }

  private async sendErrorReport(errorData: ErrorReport) {
    if (typeof window === 'undefined') {
      logger.error('Cannot send error report on server side')
      return
    }

    const response = await fetch('/api/report-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData)
    })

    if (!response.ok) {
      throw new Error(`Error reporting failed: ${response.status}`)
    }
  }

  private getCurrentUserId(): string | undefined {
    if (typeof window === 'undefined') return undefined
    
    try {
      // Try to get user ID from localStorage or sessionStorage
      const userStr = localStorage.getItem('auth-storage') || sessionStorage.getItem('auth-storage')
      if (userStr) {
        const authData = JSON.parse(userStr)
        return authData?.state?.user?.id || authData?.user?.id
      }
    } catch (error) {
      // Ignore errors getting user ID
    }
    
    return undefined
  }

  // Method to manually report errors from React components
  reportReactError(error: Error, errorInfo?: React.ErrorInfo, retryCount?: number) {
    this.reportError({
      message: error.message,
      stack: error.stack,
      errorType: 'react',
      componentStack: errorInfo?.componentStack,
      retryCount,
      severity: retryCount && retryCount > 2 ? 'high' : 'medium'
    })
  }

  // Method to report API errors
  reportApiError(error: Error, endpoint: string, statusCode?: number) {
    this.reportError({
      message: `API Error: ${error.message}`,
      stack: error.stack,
      url: endpoint,
      errorType: 'api',
      severity: statusCode && statusCode >= 500 ? 'high' : 'medium'
    })
  }

  // Method to clear reported errors (useful for testing)
  clearReportedErrors() {
    this.reportedErrors.clear()
  }
}

// Export singleton instance
export const errorReporter = ErrorReporter.getInstance()

// Convenience functions
export const reportError = (error: Partial<ErrorReport>) => {
  errorReporter.reportError(error)
}

export const reportReactError = (error: Error, errorInfo?: React.ErrorInfo, retryCount?: number) => {
  errorReporter.reportReactError(error, errorInfo, retryCount)
}

export const reportApiError = (error: Error, endpoint: string, statusCode?: number) => {
  errorReporter.reportApiError(error, endpoint, statusCode)
}