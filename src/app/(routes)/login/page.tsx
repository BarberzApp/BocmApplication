'use client'

import { useState, useEffect } from 'react'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import Link from 'next/link'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useToast } from '@/shared/components/ui/use-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Scissors, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { getAndClearRedirectUrl } from '@/shared/lib/redirect-utils'
import { getRedirectPath } from '@/shared/hooks/use-auth-zustand'
import { logger } from '@/shared/lib/logger'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { push } = useSafeNavigation()
  const { login, user, status, isInitialized } = useAuth()
  const { toast } = useToast()

  // Function to handle redirect with proper error handling
  const handleRedirect = async (userId: string) => {
    setRedirecting(true)
    setError(null)
    
    try {
      logger.debug('Starting redirect process for user', { userId })
      
      // Check for stored redirect URL first
      const redirectUrl = getAndClearRedirectUrl()
      if (redirectUrl) {
        logger.debug('Using stored redirect URL', { redirectUrl })
        push(redirectUrl)
        return
      }

      // Determine redirect path based on user profile
      const redirectPath = await getRedirectPath(userId)
      logger.debug('Determined redirect path', { redirectPath })
      
      // Attempt to redirect
      push(redirectPath)
      
    } catch (error) {
      logger.error('Redirect error', error)
      setError('Failed to redirect. Please try again.')
      
      // Fallback to reload after 3 seconds
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    }
  }

  // Use global auth state for session check and redirect
  useEffect(() => {
    if (isInitialized && user) {
      handleRedirect(user.id)
    }
  }, [isInitialized, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      logger.debug('Attempting login', { email })
      const success = await login(email, password)
      
      if (success) {
        logger.debug('Login successful, getting session')
        // Use global auth state for redirect
        if (user) {
          logger.debug('Session confirmed, redirecting')
          await handleRedirect(user.id)
        } else {
          logger.error('No user after successful login')
          setError('Login successful but user not found. Please try again.')
        }
      } else {
        logger.debug('Login failed')
        setError('Invalid email or password')
      }
    } catch (error) {
      logger.error('Login error', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    try {
      logger.debug('Starting Google OAuth login')
      
      // Use ngrok URL for development, production URL for production
      const redirectUrl = process.env.NODE_ENV === 'development' 
        ? 'https://3d6b1eb7b7c8.ngrok-free.app/auth/callback'
        : 'https://www.bocmstyle.com/auth/callback';
      
      logger.debug('Using redirect URL', { redirectUrl })
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      })
      if (error) {
        logger.error('Google login error', error)
        setError('Could not sign in with Google. Please try again.')
      }
    } catch (error) {
      logger.error('Google login exception', error)
      setError('An error occurred during Google sign-in.')
    }
  }

  // Add Google SVG icon inline
  const GoogleIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_17_40)">
        <path d="M23.766 12.276c0-.818-.074-1.604-.213-2.356H12.24v4.478h6.48c-.28 1.5-1.12 2.773-2.38 3.63v3.018h3.84c2.25-2.073 3.586-5.13 3.586-8.77z" fill="#4285F4"/>
        <path d="M12.24 24c3.24 0 5.963-1.073 7.95-2.91l-3.84-3.018c-1.067.72-2.427 1.15-4.11 1.15-3.16 0-5.84-2.13-6.8-4.99H1.48v3.13C3.46 21.36 7.58 24 12.24 24z" fill="#34A853"/>
        <path d="M5.44 14.232A7.23 7.23 0 0 1 4.8 12c0-.78.14-1.54.24-2.232V6.638H1.48A11.97 11.97 0 0 0 0 12c0 1.89.44 3.68 1.48 5.362l3.96-3.13z" fill="#FBBC05"/>
        <path d="M12.24 4.77c1.77 0 3.34.61 4.59 1.8l3.44-3.44C18.2 1.07 15.48 0 12.24 0 7.58 0 3.46 2.64 1.48 6.638l3.96 3.13c.96-2.86 3.64-4.998 6.8-4.998z" fill="#EA4335"/>
      </g>
      <defs>
        <clipPath id="clip0_17_40">
          <path fill="#fff" d="M0 0h24v24H0z"/>
        </clipPath>
      </defs>
    </svg>
  )

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-saffron" />
          <div className="text-white text-xl font-semibold mb-2">Redirecting...</div>
          {error && (
            <div className="text-red-400 text-sm mt-2">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="w-full py-6 px-6 bg-background">
        <div className="max-w-7xl mx-auto flex items-center">
          {/* Logo removed as requested */}
        </div>
      </header>
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <Card className="bg-white/5 border border-white/10 shadow-2xl rounded-3xl p-8 w-full max-w-md">
          <CardHeader className="text-center">
            <Scissors className="mx-auto h-10 w-10 text-saffron mb-2" />
            <CardTitle className="text-3xl sm:text-4xl font-bebas font-bold text-secondary mb-2">Welcome Back</CardTitle>
            <CardDescription className="text-white/80 font-pacifico mb-6">Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl px-4 py-3"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-white">Password</Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-secondary hover:underline font-pacifico"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-secondary rounded-xl px-4 py-3"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-secondary text-black font-bold px-8 py-4 rounded-xl shadow-lg shadow-secondary/25 hover:bg-secondary/90 transition-all text-lg font-bebas" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2 font-bebas">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-white/20" />
              <span className="mx-3 text-white/60 text-xs">or</span>
              <div className="flex-grow border-t border-white/20" />
            </div>
            {/* Google button with tooltip */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center w-full border border-white/20 text-white rounded-xl px-8 py-4 font-bold hover:bg-white/10 transition-all gap-2 mt-2"
                  aria-label="Sign in with Google"
                  type="button"
                >
                  <GoogleIcon />
                  <span className="font-pacifico">Sign in with Google</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign in with Google</TooltipContent>
            </Tooltip>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-white/80">
              Don't have an account?{' '}
              <Link href="/register" className="text-secondary hover:underline font-pacifico">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 