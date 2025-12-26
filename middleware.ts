import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { securityHeaders } from '@/lib/security-headers'
import { csrfProtection } from '@/lib/csrf'

export async function middleware(req: NextRequest) {
  try {
    // Apply security headers first
    const res = securityHeaders(req)
    
    // Apply CSRF protection for non-GET requests
    const csrfResponse = csrfProtection(req)
    if (csrfResponse.status !== 200) {
      return csrfResponse
    }
    
    const supabase = createMiddlewareClient({ req, res })

    // Refresh session if expired - this is crucial for external redirects
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Middleware auth error:', error)
      // Clear any invalid session data
      await supabase.auth.signOut()
      return res
    }

    // Enhanced session handling for external redirects
    if (session) {
      // Check if session is about to expire (within 10 minutes)
      const expiresAt = session.expires_at
      const now = Math.floor(Date.now() / 1000)
      const tenMinutes = 10 * 60
      
      if (expiresAt && (expiresAt - now) < tenMinutes) {
        console.log('Session expiring soon in middleware, refreshing...')
        try {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.warn('Middleware session refresh warning:', refreshError)
          } else if (refreshedSession) {
            console.log('Middleware session refreshed successfully')
          }
        } catch (refreshError) {
          console.warn('Middleware session refresh failed:', refreshError)
        }
      }

      // Add session info to response headers for client-side access
      res.headers.set('x-session-user', session.user.id)
      res.headers.set('x-session-role', session.user.user_metadata.role || 'client')
      res.headers.set('x-session-expires', session.expires_at?.toString() || '')
    }

    // Handle auth callback with improved error handling
    if (req.nextUrl.pathname === '/auth/callback') {
      const { searchParams } = req.nextUrl
      const code = searchParams.get('code')
      const next = searchParams.get('next') || '/'

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) {
            return NextResponse.redirect(new URL(next, req.url))
          } else {
            console.error('Auth callback error:', error)
            // Redirect to login with error
            return NextResponse.redirect(new URL(`/login?error=auth_callback_failed`, req.url))
          }
        } catch (callbackError) {
          console.error('Auth callback exception:', callbackError)
          return NextResponse.redirect(new URL(`/login?error=auth_callback_exception`, req.url))
        }
      }
    }

    // Special handling for Stripe Connect return/refresh pages
    const isStripeConnectPage = req.nextUrl.pathname.startsWith('/barber/connect/')
    if (isStripeConnectPage && session) {
      // Ensure session is fresh for Stripe Connect pages
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (currentSession) {
          // Add a header to indicate this is a Stripe Connect page with valid session
          res.headers.set('x-stripe-connect-session', 'valid')
        }
      } catch (stripeError) {
        console.warn('Stripe Connect session check failed:', stripeError)
      }
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// Specify which routes should be handled by the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (to avoid double processing)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/).*)',
  ],
} 