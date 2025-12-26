'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { logger } from '@/shared/lib/logger'

export default function TestSessionPage() {
  const { user, status } = useAuth()
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testSession = async () => {
      try {
        setLoading(true)
        
        // Test 1: Check auth hook status
        logger.debug('Auth hook status', { userId: user?.id, status })
        
        // Test 2: Check session directly
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        logger.debug('Direct session check', { 
          hasSession: !!session, 
          hasError: !!sessionError,
          userId: session?.user?.id 
        })
        
        // Test 3: Check user directly
        const { data: { user: directUser }, error: userError } = await supabase.auth.getUser()
        logger.debug('Direct user check', { 
          hasUser: !!directUser, 
          hasError: !!userError,
          userId: directUser?.id 
        })
        
        // Test 4: Call our debug API endpoint
        const response = await fetch('/api/debug-session')
        const apiData = await response.json()
        logger.debug('API debug response', { hasData: !!apiData })
        
        setSessionData({
          authHook: { user: user?.id, status },
          directSession: { hasSession: !!session, sessionError: sessionError?.message, userId: session?.user?.id },
          directUser: { hasUser: !!directUser, userError: userError?.message, userId: directUser?.id },
          apiDebug: apiData
        })
        
      } catch (err) {
        logger.error('Session test error', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    testSession()
  }, [user, status])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Testing Session Status...</h1>
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Session Status Test</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div className="space-y-6">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Auth Hook Status</h2>
          <pre className="text-sm bg-white p-2 rounded overflow-auto">
            {JSON.stringify(sessionData?.authHook, null, 2)}
          </pre>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Direct Session Check</h2>
          <pre className="text-sm bg-white p-2 rounded overflow-auto">
            {JSON.stringify(sessionData?.directSession, null, 2)}
          </pre>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Direct User Check</h2>
          <pre className="text-sm bg-white p-2 rounded overflow-auto">
            {JSON.stringify(sessionData?.directUser, null, 2)}
          </pre>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">API Debug Response</h2>
          <pre className="text-sm bg-white p-2 rounded overflow-auto">
            {JSON.stringify(sessionData?.apiDebug, null, 2)}
          </pre>
        </div>
        
        <div className="bg-blue-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Summary</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Auth Hook Status:</strong> {status}</li>
            <li><strong>User ID:</strong> {user?.id || 'None'}</li>
            <li><strong>Has Session:</strong> {sessionData?.directSession?.hasSession ? 'Yes' : 'No'}</li>
            <li><strong>API Can Access Session:</strong> {sessionData?.apiDebug?.summary?.isAuthenticated ? 'Yes' : 'No'}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
