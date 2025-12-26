// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV || 'development',

  // Enable Replay in production
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text content and user input
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from request
    if (event.request) {
      // Remove cookies
      if (event.request.cookies) {
        delete event.request.cookies;
      }
      
      // Filter headers
      if (event.request.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        sensitiveHeaders.forEach(header => {
          if (event.request?.headers?.[header]) {
            delete event.request.headers[header];
          }
        });
      }
    }

    // Filter sensitive data from extra context
    if (event.extra) {
      Object.keys(event.extra).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('api_key') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('auth')
        ) {
          delete event.extra![key];
        }
      });
    }

    // Filter user data
    if (event.user) {
      // Only keep safe user identifiers
      const safeUser = {
        id: event.user.id,
        email: event.user.email ? event.user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : undefined,
      };
      event.user = safeUser;
    }

    return event;
  },

  // Ignore common non-critical errors
  ignoreErrors: [
    // Network errors
    'NetworkError',
    'Failed to fetch',
    'Network request failed',
    'Load failed',
    
    // Browser extension errors
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    
    // User cancellation
    'AbortError',
    'User cancelled',
    'canceled',
    
    // Timeout errors
    'timeout',
    'TimeoutError',
    
    // Chrome extension errors
    'ChunkLoadError',
    'Loading chunk',
    
    // Service worker errors
    'ServiceWorker registration failed',
  ],

  // Set sample rate for session replay
  beforeSendTransaction(event) {
    // Don't send transactions in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }
    return event;
  },
});

