import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/shared/components/ui/toaster'
import { ThemeProvider } from "@/shared/components/theme/theme-provider"
import { TooltipProvider } from "@/shared/components/ui/tooltip"

import { Navbar } from "@/shared/components/layout/navbar"
import { EnhancedErrorBoundary } from "@/shared/components/ui/enhanced-error-boundary"
import { LoadingProvider } from "@/shared/components/ui/loading-provider"
import { PWARegistration } from "@/shared/components/pwa/pwa-registration"
import { LoadingSpinner } from "@/shared/components/ui/loading-spinner"
import { ErrorReportingProvider } from "@/shared/components/error-reporting-provider"
import { cn } from "@/shared/lib/utils"
import React from 'react'
import { logger } from "@/shared/lib/logger"

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'BOCM',
  description: 'Book your next haircut with ease',
  themeColor: '#000000',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1
  }
}

// ClientNavWrapper is a client component that handles nav visibility
const ClientNavWrapper = React.lazy(() => import('@/shared/components/layout/client-nav-wrapper'));

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BOCM" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Conservative PWA registration - only in production and HTTPS
              if ('serviceWorker' in navigator && window.location.hostname !== 'localhost' && window.location.protocol === 'https:') {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js')
                    .then(function(registration) {
                      // Service worker registered successfully
                    })
                    .catch(function(registrationError) {
                      // Service worker registration failed - silent in production
                    });
                });
              }
              
              // Add beforeinstallprompt event listener for PWA install
              let deferredPrompt;
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                // PWA install prompt ready
              });
            `
          }}
        />
      </head>
      <body className={cn(inter.className, "bg-background min-h-screen")}> 
        <ErrorReportingProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <TooltipProvider>
            <EnhancedErrorBoundary>
              <LoadingProvider>
              <React.Suspense fallback={null}>
                <ClientNavWrapper>{children}</ClientNavWrapper>
              </React.Suspense>
              <Toaster />
              <PWARegistration />
              </LoadingProvider>
            </EnhancedErrorBoundary>
            </TooltipProvider>
          </ThemeProvider>
        </ErrorReportingProvider>
      </body>
    </html>
  )
} 