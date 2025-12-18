'use client'

import { useEffect } from 'react'
import { errorReporter } from '@/shared/utils/error-reporter'
import { logger } from '@/shared/lib/logger'

interface ErrorReportingProviderProps {
  children: React.ReactNode
}

export function ErrorReportingProvider({ children }: ErrorReportingProviderProps) {
  useEffect(() => {
    // Initialize error reporter (this will set up global error handlers)
    errorReporter

    // Add any additional initialization here if needed
    logger.debug('Error reporting system initialized')

    return () => {
      // Cleanup if needed
      errorReporter.clearReportedErrors()
    }
  }, [])

  return <>{children}</>
}