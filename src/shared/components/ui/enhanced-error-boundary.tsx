'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug } from 'lucide-react'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { reportReactError } from '@/shared/utils/error-reporter'
import { logger } from '@/shared/lib/logger'
import * as Sentry from '@sentry/nextjs'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  retryCount: number
  lastErrorTime: number
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ 
    error: Error; 
    errorInfo?: React.ErrorInfo;
    retryError: () => void;
    resetError: () => void;
  }>
  maxRetries?: number
  retryDelay?: number
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class EnhancedErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout?: NodeJS.Timeout

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { 
      hasError: false, 
      retryCount: 0,
      lastErrorTime: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { 
      hasError: true, 
      error,
      lastErrorTime: Date.now()
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('EnhancedErrorBoundary caught an error', error, { errorInfo })
    
    // Send to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorBoundary: true,
          retryCount: this.state.retryCount,
        },
        extra: {
          errorInfo,
        },
      })
    }
    
    // Report error with SMS notification
    reportReactError(error, errorInfo, this.state.retryCount)
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
    
    // Store error info in state
    this.setState(prevState => ({
      ...prevState,
      errorInfo
    }))
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  retryError = () => {
    const { maxRetries = 3, retryDelay = 1000 } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      logger.error('Max retries exceeded')
      return
    }

    logger.debug(`Retrying... Attempt ${retryCount + 1}/${maxRetries}`)
    
    this.setState(prev => ({ 
      retryCount: prev.retryCount + 1,
      hasError: false,
      error: undefined,
      errorInfo: undefined
    }))

    // Clear any existing timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }

    // Add delay before retry
    this.retryTimeout = setTimeout(() => {
      this.forceUpdate()
    }, retryDelay * (retryCount + 1)) // Exponential backoff
  }

  resetError = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
    
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      retryCount: 0
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return (
          <this.props.fallback 
            error={this.state.error!} 
            errorInfo={this.state.errorInfo}
            retryError={this.retryError}
            resetError={this.resetError}
          />
        )
      }

      return <DefaultErrorFallback 
        error={this.state.error!} 
        errorInfo={this.state.errorInfo}
        retryCount={this.state.retryCount}
        maxRetries={this.props.maxRetries || 3}
        onRetry={this.retryError}
        onReset={this.resetError}
      />
    }

    return this.props.children
  }
}

interface DefaultErrorFallbackProps {
  error: Error
  errorInfo?: React.ErrorInfo
  retryCount: number
  maxRetries: number
  onRetry: () => void
  onReset: () => void
}

function DefaultErrorFallback({ 
  error, 
  errorInfo, 
  retryCount, 
  maxRetries, 
  onRetry, 
  onReset 
}: DefaultErrorFallbackProps) {
  const { push, back } = useSafeNavigation()
  const { status } = useAuth()
  const [showDetails, setShowDetails] = useState(false)

  // Auto-retry for auth-related errors
  useEffect(() => {
    if (error.message.includes('auth') || error.message.includes('session')) {
      const timer = setTimeout(() => {
        if (retryCount < maxRetries) {
          onRetry()
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [error.message, retryCount, maxRetries, onRetry])

  const isAuthError = error.message.includes('auth') || error.message.includes('session')
  const isNetworkError = error.message.includes('network') || error.message.includes('fetch')
  const canRetry = retryCount < maxRetries

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary via-darkpurple to-secondary">
      <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-500/20 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <CardTitle className="text-xl text-white">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-white/80 text-sm">
            {isAuthError 
              ? "We're having trouble with your session. Please try again."
              : isNetworkError
              ? "Network connection issue. Please check your internet and try again."
              : "An unexpected error occurred. We're working to fix it."
            }
          </p>

          {retryCount > 0 && (
            <p className="text-saffron text-sm">
              Retry attempt {retryCount}/{maxRetries}
            </p>
          )}

          <div className="space-y-2">
            {canRetry && (
              <Button 
                onClick={onRetry} 
                className="w-full bg-saffron hover:bg-saffron/90 text-primary font-semibold"
                disabled={isAuthError && retryCount > 0}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {isAuthError ? 'Reconnecting...' : 'Try Again'}
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => push('/')} 
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>

            <Button 
              variant="outline" 
              onClick={() => back()} 
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>

            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Page
            </Button>
          </div>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-white/60 hover:text-white"
              >
                <Bug className="mr-2 h-4 w-4" />
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>
              
              {showDetails && (
                <div className="mt-2 p-3 bg-black/20 rounded text-left text-xs text-white/80 max-h-40 overflow-auto">
                  <p><strong>Error:</strong> {error.message}</p>
                  <p><strong>Stack:</strong></p>
                  <pre className="whitespace-pre-wrap">{error.stack}</pre>
                  {errorInfo && (
                    <>
                      <p><strong>Component Stack:</strong></p>
                      <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Hook for functional components to catch errors
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const handleError = React.useCallback((error: Error) => {
    logger.error('Error caught by useErrorHandler', error)
    reportReactError(error, undefined, retryCount)
    setError(error)
  }, [retryCount])

  const retryError = React.useCallback(() => {
    setRetryCount(prev => prev + 1)
    setError(null)
  }, [])

  const resetError = React.useCallback(() => {
    setError(null)
    setRetryCount(0)
  }, [])

  return { 
    error, 
    retryCount,
    handleError, 
    retryError,
    resetError 
  }
} 