'use client'

import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card'
import { Search, Scissors, User, Calendar, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/shared/hooks/use-auth-zustand'
import { useSafeNavigation } from '@/shared/hooks/use-safe-navigation'
import { storeRedirectUrl } from '@/shared/lib/redirect-utils'
import { getNotFoundSuggestions, type NotFoundSuggestion } from '@/shared/lib/not-found-suggestions'
import { LogoBrand } from '@/shared/components/layout/logo-brand'
import { useMemo } from 'react'

const iconMap = {
  search: Search,
  scissors: Scissors,
  user: User,
  calendar: Calendar,
  settings: Settings
}

export default function NotFound() {
  const router = useRouter()
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const { user } = useAuth()
  const { push } = useSafeNavigation()

  const suggestions = useMemo(
    () => getNotFoundSuggestions(pathname, user),
    [pathname, user]
  )

  const handleLoginRedirect = () => {
    if (pathname && !pathname.includes('/login') && !pathname.includes('/register')) {
      storeRedirectUrl(pathname)
    }
    push('/login')
  }

  return (
    <div className="min-h-screen bg-background from-black via-gray-900 to-black flex items-center justify-center px-4">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>
      <Card className="max-w-2xl w-full bg-transparent border-gray-800">
        <CardHeader className="text-center space-y-6">
          <div className="flex justify-center">
            <LogoBrand size="md" />
          </div>
          
          <div>
            <h1 className="text-8xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-saffron via-yellow-400 to-saffron animate-pulse">
              404
            </h1>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Oops! Page Not Found
            </h2>
            <p className="text-lg text-gray-300 max-w-lg mx-auto leading-relaxed">
              Looks like this page took a little too much off the top. 
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {suggestions.length > 0 && (
            <div className="space-y-4">
              <p className="text-gray-300 text-lg text-center">
                Based on where you were trying to go, you might be looking for:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestions.map((suggestion, index) => {
                  const Icon = iconMap[suggestion.icon]
                  return (
                    <Button
                      key={index}
                      asChild
                      variant="outline"
                      className="h-auto p-4 bg-foreground border-gray-700 hover:bg-saffron/10 hover:border-saffron transition-all duration-300"
                    >
                      <Link href={suggestion.href}>
                        <div className="flex flex-col items-center text-center space-y-2">
                          <div className="text-saffron">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="font-semibold text-white text-sm">
                            {suggestion.title}
                          </div>
                          <div className="text-xs text-gray-400">
                            {suggestion.description}
                          </div>
                        </div>
                      </Link>
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button 
              onClick={() => router.back()}
              variant="outline" 
              className="w-full sm:w-auto bg-transparent border-saffron text-secondary hover:bg-saffron hover:text-black transition-all duration-300"
            >
              Go Back
            </Button>
            
            <Button 
              asChild 
              className="w-full sm:w-auto bg-saffron text-black hover:bg-saffron/90 transition-all duration-300"
            >
              <Link href="/landing">
                Return Home
              </Link>
            </Button>
            
            {!user && (
              <Button 
                onClick={handleLoginRedirect}
                variant="outline" 
                className="w-full sm:w-auto bg-transparent border-white text-white hover:bg-white hover:text-black transition-all duration-300"
              >
                Login
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 