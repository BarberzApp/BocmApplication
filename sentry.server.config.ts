// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production' && !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),

  environment: process.env.NODE_ENV || 'development',

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
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token', 'x-forwarded-for'];
        sensitiveHeaders.forEach(header => {
          if (event.request?.headers?.[header]) {
            delete event.request.headers[header];
          }
        });
      }

      // Remove query string if it contains sensitive data
      if (event.request.url) {
        try {
          const url = new URL(event.request.url);
          const sensitiveParams = ['token', 'key', 'password', 'secret', 'api_key'];
          sensitiveParams.forEach(param => {
            if (url.searchParams.has(param)) {
              url.searchParams.delete(param);
            }
          });
          event.request.url = url.toString();
        } catch {
          // Invalid URL, skip
        }
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
          lowerKey.includes('auth') ||
          lowerKey.includes('stripe') ||
          lowerKey.includes('supabase')
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
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    
    // Database connection errors (handled by retry logic)
    'PGRST116', // Not found
    'PGRST301', // JWT expired
    
    // User cancellation
    'AbortError',
    'User cancelled',
    
    // Timeout errors
    'timeout',
    'TimeoutError',
  ],
});

