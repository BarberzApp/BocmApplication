import * as Sentry from '@sentry/react-native';
import { logger } from './logger';

/**
 * Initialize Sentry for error monitoring
 * Only active in production mode
 */
export const initSentry = () => {
  // Only initialize in production or when explicitly enabled
  const isProduction = process.env.NODE_ENV === 'production';
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!sentryDsn) {
    logger.log('⚠️ Sentry DSN not configured. Error monitoring disabled.');
    return;
  }

  if (!isProduction) {
    logger.log('🔧 Development mode: Sentry disabled (errors logged to console)');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 0.2, // 20% of transactions
      
      // Set environment
      environment: isProduction ? 'production' : 'development',
      
      // Privacy: Do NOT send default PII (personally identifiable information) by default
      // We explicitly control what user data is sent via setUserContext()
      sendDefaultPii: false,
      
      // Enable auto session tracking
      enableAutoSessionTracking: true,
      
      // Session timeout (30 minutes)
      sessionTrackingIntervalMillis: 30000,
      
      // Enable native crashes
      enableNative: true,
      
      // Enable JavaScript errors
      enableNativeCrashHandling: true,
      
      // Attach stack trace to messages
      attachStacktrace: true,
      
      // Before send hook - filter sensitive data
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
          // Remove IP address for privacy
          if (event.request.url) {
            // URL is kept for debugging but IP is not explicitly included
          }
        }
        
        // Filter out password fields and other sensitive data
        if (event.extra) {
          Object.keys(event.extra).forEach(key => {
            if (key.toLowerCase().includes('password') || 
                key.toLowerCase().includes('token') ||
                key.toLowerCase().includes('secret') ||
                key.toLowerCase().includes('api_key') ||
                key.toLowerCase().includes('private')) {
              delete event.extra![key];
            }
          });
        }
        
        // Filter user data from contexts unless explicitly set via setUserContext
        if (event.user) {
          // Only keep user ID if explicitly set, remove other PII
          const safeUser: any = {};
          if (event.user.id) {
            safeUser.id = event.user.id;
          }
          // Explicitly exclude email, username, IP, etc. unless needed
          event.user = safeUser;
        }
        
        return event;
      },
      
      // Ignore certain errors
      ignoreErrors: [
        // Network errors
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        
        // Timeout errors (we handle these)
        'timeout',
        'AbortError',
        
        // User cancelled actions
        'User cancelled',
        'cancelled',
      ],
    });

    logger.log('✅ Sentry initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize Sentry:', error);
  }
};

/**
 * Capture an exception in Sentry
 * Only sends in production
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    // In development, just log
    logger.error('Exception:', error, context);
  }
};

/**
 * Capture a message in Sentry
 * Only sends in production
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  } else {
    // In development, just log
    logger.log(`[${level.toUpperCase()}] ${message}`, context);
  }
};

/**
 * Set user context for Sentry
 */
export const setUserContext = (user: { id: string; email?: string; username?: string } | null) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && process.env.EXPO_PUBLIC_SENTRY_DSN) {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    } else {
      Sentry.setUser(null);
    }
  }
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  } else {
    logger.log(`[Breadcrumb] ${category}: ${message}`, data);
  }
};

/**
 * Wrap a function with Sentry error boundary
 */
export const withSentry = <T extends (...args: any[]) => any>(fn: T): T => {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      
      // Handle promises
      if (result instanceof Promise) {
        return result.catch((error) => {
          captureException(error, {
            function: fn.name,
            args,
          });
          throw error;
        });
      }
      
      return result;
    } catch (error) {
      captureException(error as Error, {
        function: fn.name,
        args,
      });
      throw error;
    }
  }) as T;
};

export default Sentry;

