'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle, Clock, Search, Database } from 'lucide-react'
import { logger } from '@/shared/lib/logger'

export default function DebugStripePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [debugData, setDebugData] = useState<any>(null)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const checkStatus = async () => {
    if (!user) {
      setError('No user found. Please log in.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setDebugData(null)

    try {
      const response = await fetch('/api/connect/debug-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check status')
      }

      setDebugData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const searchStripeAccounts = async () => {
    if (!user) {
      setError('No user found. Please log in.')
      return
    }

    setSearching(true)
    setError(null)
    setSuccessMessage(null)
    setSearchResults(null)

    try {
      const response = await fetch('/api/connect/find-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id,
          email: user.email 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search for accounts')
      }

      setSearchResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSearching(false)
    }
  }

  const updateDatabaseWithAccountId = async (stripeAccountId: string) => {
    if (!user) {
      setError('No user found. Please log in.')
      return
    }

    setUpdating(true)
    setError(null)
    setSuccessMessage(null)

    try {
      logger.debug('Updating database with Stripe account ID', { stripeAccountId })
      
      const response = await fetch('/api/connect/update-account-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id,
          stripeAccountId 
        }),
      })

      const data = await response.json()
      logger.debug('Update response', { success: data.success })

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update database')
      }

      setSuccessMessage(`Successfully updated database with Stripe account ID: ${stripeAccountId}`)
      
      // Refresh the debug data to show the updated status
      setTimeout(() => {
        checkStatus()
      }, 1000)
      
    } catch (err) {
      logger.error('Error updating database', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setUpdating(false)
    }
  }

  const refreshStripeStatus = async () => {
    if (!user) {
      setError('No user found. Please log in.')
      return
    }

    setRefreshing(true)
    setError(null)
    setSuccessMessage(null)

    try {
      logger.debug('Refreshing Stripe account status for user', { userId: user.id })
      
      const response = await fetch('/api/connect/refresh-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id
        }),
      })

      const data = await response.json()
      logger.debug('Refresh response', { success: data.success })

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh status')
      }

      if (data.success) {
        setSuccessMessage(`Account status refreshed! Previous: ${data.data.previousStatus}, Current: ${data.data.currentStatus}`)
        
        // Refresh the debug data to show the updated status
        setTimeout(() => {
          checkStatus()
        }, 1000)
      } else {
        setSuccessMessage(data.message || 'No Stripe account found')
      }
      
    } catch (err) {
      logger.error('Error refreshing Stripe status', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setRefreshing(false)
    }
  }

  const showAllBarbers = async () => {
    if (!user) {
      setError('No user found. Please log in.')
      return
    }

    try {
      const response = await fetch('/api/connect/debug-all-barbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      logger.debug('All barbers in database', { count: data.barbers?.length })
      
      if (data.barbers) {
        setSuccessMessage(`Found ${data.barbers.length} barber records.`)
      } else {
        setError('Failed to fetch barber records')
      }
      
    } catch (err) {
      logger.error('Error fetching all barbers', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  useEffect(() => {
    if (user) {
      checkStatus()
    }
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Debug Stripe Status</CardTitle>
            <CardDescription>Please log in to check your Stripe account status</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Stripe Account Debug</CardTitle>
            <CardDescription>
              Debug information for user: {user.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button onClick={checkStatus} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Refresh Status
              </Button>
              <Button onClick={searchStripeAccounts} disabled={searching} variant="outline">
                {searching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Search className="mr-2 h-4 w-4" />
                Search Stripe Accounts
              </Button>
              <Button onClick={refreshStripeStatus} disabled={refreshing} variant="outline">
                {refreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Clock className="mr-2 h-4 w-4" />
                Refresh Stripe Status
              </Button>
              <Button onClick={showAllBarbers} disabled={loading} variant="outline">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Database className="mr-2 h-4 w-4" />
                Show All Barbers
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="mb-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            {debugData && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Database Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Barber ID:</strong> {debugData.barber.id}
                      </div>
                      <div>
                        <strong>User ID:</strong> {debugData.barber.user_id}
                      </div>
                      <div>
                        <strong>Business Name:</strong> {debugData.barber.business_name}
                      </div>
                      <div>
                        <strong>Stripe Account ID:</strong> {debugData.barber.stripe_account_id || 'None'}
                      </div>
                      <div>
                        <strong>Database Status:</strong> {debugData.barber.stripe_account_status || 'None'}
                      </div>
                      <div>
                        <strong>Account Ready:</strong> {debugData.barber.stripe_account_ready ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {debugData.stripeAccount && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Stripe Account Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Stripe Account ID:</strong> {debugData.stripeAccount.id}
                        </div>
                        <div>
                          <strong>Charges Enabled:</strong> 
                          {debugData.stripeAccount.charges_enabled ? (
                            <CheckCircle className="inline ml-2 h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="inline ml-2 h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <div>
                          <strong>Details Submitted:</strong> {debugData.stripeAccount.details_submitted ? 'Yes' : 'No'}
                        </div>
                        <div>
                          <strong>Payouts Enabled:</strong> {debugData.stripeAccount.payouts_enabled ? 'Yes' : 'No'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Debug Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Has Stripe ID in Database:</strong> {debugData.debug.hasStripeId ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <strong>Database Status:</strong> {debugData.debug.databaseStatus || 'None'}
                      </div>
                      <div>
                        <strong>Stripe API Status:</strong> {debugData.debug.stripeStatus}
                      </div>
                      <div>
                        <strong>Status Mismatch:</strong> {
                          debugData.debug.databaseStatus !== debugData.debug.stripeStatus ? 'Yes' : 'No'
                        }
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {debugData.debug.hasStripeId && debugData.debug.databaseStatus !== debugData.debug.stripeStatus && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      There's a mismatch between your database status and Stripe API status. 
                      This might indicate a webhook issue. The webhook should update your database 
                      when your Stripe account status changes.
                    </AlertDescription>
                  </Alert>
                )}

                {!debugData.debug.hasStripeId && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No Stripe account ID found in your database. This could mean:
                      <ul className="list-disc list-inside mt-2">
                        <li>The webhook didn't receive the account creation event</li>
                        <li>The webhook failed to update the database</li>
                        <li>The Stripe account creation process didn't complete</li>
                      </ul>
                      <p className="mt-2">
                        <strong>Try clicking "Search Stripe Accounts" above to find your account!</strong>
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {searchResults && (
              <div className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Stripe Account Search Results</CardTitle>
                    <CardDescription>
                      Searching for accounts with email: {searchResults.searchEmail}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Total Accounts Found:</strong> {searchResults.totalAccountsFound}
                        </div>
                        <div>
                          <strong>Matching Your Email:</strong> {searchResults.matchingAccounts}
                        </div>
                      </div>

                      {searchResults.accounts.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-semibold">Your Stripe Accounts:</h4>
                          {searchResults.accounts.map((account: any, index: number) => (
                            <Card key={account.id} className="p-3">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <strong>Account ID:</strong> {account.id}
                                </div>
                                <div>
                                  <strong>Email:</strong> {account.email}
                                </div>
                                <div>
                                  <strong>Charges Enabled:</strong> {account.charges_enabled ? 'Yes' : 'No'}
                                </div>
                                <div>
                                  <strong>Details Submitted:</strong> {account.details_submitted ? 'Yes' : 'No'}
                                </div>
                                <div>
                                  <strong>Type:</strong> {account.type}
                                </div>
                                <div>
                                  <strong>Created:</strong> {new Date(account.created * 1000).toLocaleDateString()}
                                </div>
                              </div>
                              {account.metadata?.barber_id && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <strong>Barber ID in metadata:</strong> {account.metadata.barber_id}
                                </div>
                              )}
                              
                              {/* Show update button if this account is not in the database */}
                              {(!debugData?.barber?.stripe_account_id || 
                                debugData.barber.stripe_account_id !== account.id) && (
                                <div className="mt-3 pt-3 border-t">
                                  <Button 
                                    onClick={() => updateDatabaseWithAccountId(account.id)}
                                    disabled={updating}
                                    size="sm"
                                    variant="outline"
                                  >
                                    {updating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                    <Database className="mr-2 h-3 w-3" />
                                    Update Database with This Account
                                  </Button>
                                </div>
                              )}
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            No Stripe accounts found with your email address ({searchResults.searchEmail}).
                            This could mean:
                            <ul className="list-disc list-inside mt-2">
                              <li>You haven't created a Stripe Connect account yet</li>
                              <li>The account was created with a different email</li>
                              <li>The account was deleted</li>
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {searchResults.suggestions && (
                        <Card className="p-3 bg-blue-50">
                          <h4 className="font-semibold mb-2">Suggestions:</h4>
                          <div className="space-y-1 text-sm">
                            <div>• Has matching email: {searchResults.suggestions.hasMatchingEmail ? 'Yes' : 'No'}</div>
                            <div>• Has barber record: {searchResults.suggestions.hasBarberRecord ? 'Yes' : 'No'}</div>
                            <div>• Has Stripe ID in database: {searchResults.suggestions.hasStripeIdInDatabase ? 'Yes' : 'No'}</div>
                            {searchResults.suggestions.databaseStripeId && (
                              <div>• Database Stripe ID: {searchResults.suggestions.databaseStripeId}</div>
                            )}
                            {searchResults.suggestions.matchingStripeIds.length > 0 && (
                              <div>• Found Stripe IDs: {searchResults.suggestions.matchingStripeIds.join(', ')}</div>
                            )}
                          </div>
                        </Card>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 