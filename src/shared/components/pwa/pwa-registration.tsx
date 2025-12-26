'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useToast } from '@/shared/components/ui/use-toast'
import { Download, X, CheckCircle, AlertCircle } from 'lucide-react'
import { logger } from '@/shared/lib/logger'

interface PWAInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Extend Navigator interface for PWA detection
interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

export function PWARegistration() {
  const [deferredPrompt, setDeferredPrompt] = useState<PWAInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Check if PWA is already installed
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInApp = (navigator as NavigatorWithStandalone).standalone === true
      setIsInstalled(isStandalone || isInApp)
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as PWAInstallPromptEvent)
      setShowInstallPrompt(true)
    }

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
      toast({
        title: 'App Installed!',
        description: 'BOCM has been installed successfully.',
      })
    }

    // Register service worker with improved error handling
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          // Only register in production or if explicitly enabled
          if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === 'true') {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
              scope: '/',
              updateViaCache: 'none' // Always check for updates
            })

            setSwRegistration(registration)

            // Handle service worker updates more gracefully
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Only show update notification if user is not actively using the app
                    const isUserActive = !document.hidden && document.visibilityState === 'visible'
                    if (!isUserActive) {
                      toast({
                        title: 'Update Available',
                        description: 'A new version of BOCM is available. Refresh to update.',
                        action: (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.reload()}
                          >
                            Refresh
                          </Button>
                        ),
                      })
                    }
                  }
                })
              }
            })

            // Handle service worker errors without disrupting the app
            registration.addEventListener('error', (event) => {
              logger.warn('Service Worker registration error', { event })
              // Don't show error to user - PWA is not critical for app functionality
            })

            logger.debug('Service Worker registered successfully', { scope: registration.scope })
          } else {
            logger.debug('Service Worker disabled in development')
          }
        } catch (error) {
          logger.warn('Service Worker registration failed', error)
          // Don't show error to user as PWA is not critical for app functionality
        }
      }
    }

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Register service worker
    registerServiceWorker()

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [toast])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      // Show the install prompt
      await deferredPrompt.prompt()

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        logger.debug('User accepted the install prompt')
        setIsInstalled(true)
        setShowInstallPrompt(false)
        toast({
          title: 'Installation Started',
          description: 'BOCM is being installed on your device.',
        })
      } else {
        logger.debug('User dismissed the install prompt')
        toast({
          title: 'Installation Cancelled',
          description: 'You can install BOCM later from your browser menu.',
        })
      }
    } catch (error) {
      logger.error('Install prompt error', error)
      toast({
        title: 'Installation Failed',
        description: 'Unable to install the app. Please try again later.',
        variant: 'destructive',
      })
    } finally {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    setDeferredPrompt(null)
  }

  // Don't show anything if already installed or no prompt available
  if (isInstalled || !showInstallPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Download className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Install BOCM</h3>
            <p className="text-xs text-muted-foreground">
              Get quick access to book appointments and manage your barber business
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="bg-primary hover:bg-primary/90"
          >
            Install
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Hook for PWA status
export function usePWAStatus() {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInApp = (navigator as NavigatorWithStandalone).standalone === true
      setIsInstalled(isStandalone || isInApp)
      setIsOnline(navigator.onLine)

      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  return { isInstalled, isOnline }
} 