'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { logger } from '@/shared/lib/logger'

export default function TestCalendarAuthPage() {
  const { user, status } = useAuth()
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testCalendarAuth = async () => {
    try {
      setLoading(true)
      setError(null)
      
      logger.debug('Testing calendar OAuth with authentication')
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No access token available - please log in first')
      }
      
      logger.debug('Session found, testing calendar OAuth endpoint', { userId: session.user?.id })
      
      // Test the calendar OAuth endpoint with proper authentication
      const response = await fetch('/api/auth/google-calendar', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      logger.debug('Calendar OAuth response', { status: response.status })
      
      const data = await response.json()
      logger.debug('Calendar OAuth response data', { success: data.success })
      
      setTestResults({
        session: {
          hasSession: !!session,
          userId: session?.user?.id,
          accessToken: session?.access_token ? 'Present' : 'Missing'
        },
        apiResponse: {
          status: response.status,
          ok: response.ok,
          data: data
        }
      })
      
    } catch (err) {
      logger.error('Calendar auth test error', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Testing Calendar Authentication...</h1>
        <div className="animate-pulse">Loading auth status...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Calendar Authentication Test</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <strong>Not Authenticated:</strong> Please log in first to test calendar authentication.
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Calendar Authentication Test</h1>
      
      <div className="mb-6">
        <button 
          onClick={testCalendarAuth}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
        >
          {loading ? 'Testing...' : 'Test Calendar OAuth Endpoint'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {testResults && (
        <div className="space-y-6">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Session Status</h2>
            <pre className="text-sm bg-white p-2 rounded overflow-auto">
              {JSON.stringify(testResults.session, null, 2)}
            </pre>
          </div>
          
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">API Response</h2>
            <pre className="text-sm bg-white p-2 rounded overflow-auto">
              {JSON.stringify(testResults.apiResponse, null, 2)}
            </pre>
          </div>
          
          <div className="bg-blue-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Test Summary</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Authentication Status:</strong> {status}</li>
              <li><strong>User ID:</strong> {user?.id || 'None'}</li>
              <li><strong>Has Session:</strong> {testResults.session?.hasSession ? 'Yes' : 'No'}</li>
              <li><strong>API Response Status:</strong> {testResults.apiResponse?.status}</li>
              <li><strong>API Request Successful:</strong> {testResults.apiResponse?.ok ? 'Yes' : 'No'}</li>
              {testResults.apiResponse?.data?.url && (
                <li><strong>OAuth URL Generated:</strong> Yes</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
