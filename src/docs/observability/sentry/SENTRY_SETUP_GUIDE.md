# Sentry Setup Guide for Next.js Web App

## ✅ Integration Complete

Sentry has been fully integrated into the Next.js web application. This guide will help you complete the setup by creating a Sentry account and configuring the DSN.

## 📦 What's Been Installed

- `@sentry/nextjs` - Official Sentry SDK for Next.js
- Automatic error tracking for client, server, and edge runtimes
- Performance monitoring (10% sample rate in production)
- Session replay for debugging (1% session sample, 100% error replay)
- Integration with logger utility (errors automatically sent to Sentry)

## 📁 Files Created

1. **`sentry.client.config.ts`** - Client-side Sentry configuration
2. **`sentry.server.config.ts`** - Server-side Sentry configuration
3. **`sentry.edge.config.ts`** - Edge runtime Sentry configuration
4. **`src/instrumentation.ts`** - Next.js instrumentation hook
5. **`.sentryclirc`** - Sentry CLI configuration (for source maps)

## 🔧 Configuration Files Modified

1. **`next.config.mjs`** - Added Sentry webpack plugin
2. **`src/shared/lib/logger.ts`** - Integrated Sentry error reporting
3. **`src/shared/components/ui/enhanced-error-boundary.tsx`** - Sends errors to Sentry

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Sentry Account

1. Go to [https://sentry.io/signup/](https://sentry.io/signup/)
2. Sign up for a free account (or use existing account)
3. Create a new project:
   - Select **Next.js** as the platform
   - Name it "barber-app" or similar
   - Choose your organization

### Step 2: Get Your DSN

1. After creating the project, Sentry will show you a DSN
2. It looks like: `https://abc123def456@o123456.ingest.sentry.io/789012`
3. Copy this DSN

### Step 3: Add Environment Variables

Add to your `.env.local` (or production environment):

```env
# Sentry Error Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn-here@o123456.ingest.sentry.io/789012

# Optional: Server-side DSN (can use same as NEXT_PUBLIC_SENTRY_DSN)
SENTRY_DSN=https://your-dsn-here@o123456.ingest.sentry.io/789012

# Optional: For source maps upload (recommended for production)
SENTRY_ORG=your-org-name
SENTRY_PROJECT=your-project-name
SENTRY_AUTH_TOKEN=your-auth-token
```

### Step 4: Update .sentryclirc (Optional)

If you want to upload source maps, update `.sentryclirc`:

```ini
[auth]
token=YOUR_SENTRY_AUTH_TOKEN

[defaults]
org=YOUR_SENTRY_ORG
project=YOUR_SENTRY_PROJECT
url=https://sentry.io/
```

To get your auth token:
1. Go to Sentry → Settings → Auth Tokens
2. Create a new token with `project:releases` scope
3. Copy the token

### Step 5: Test It

1. Start your development server:
   ```bash
   npm run dev
   ```

2. In development, Sentry is **disabled** (errors logged to console only)

3. To test in production mode:
   ```bash
   NODE_ENV=production npm run build
   NODE_ENV=production npm start
   ```

4. Trigger a test error (e.g., visit a non-existent page or trigger an error)
5. Check your Sentry dashboard - you should see the error appear!

## 🎯 How It Works

### Automatic Error Tracking

All errors logged via `logger.error()` are automatically sent to Sentry in production:

```typescript
import { logger } from '@/shared/lib/logger'

try {
  // Some code that might fail
} catch (error) {
  logger.error('Operation failed', error, { context: 'additional info' })
  // This error is automatically sent to Sentry in production
}
```

### Error Boundary Integration

The `EnhancedErrorBoundary` component automatically sends React errors to Sentry:

```tsx
<EnhancedErrorBoundary>
  <YourApp />
</EnhancedErrorBoundary>
```

### Manual Error Reporting

You can also manually capture errors:

```typescript
import * as Sentry from '@sentry/nextjs'

// Capture an exception
Sentry.captureException(error, {
  tags: { feature: 'booking' },
  extra: { bookingId: '123' },
})

// Capture a message
Sentry.captureMessage('Something important happened', {
  level: 'warning',
})
```

## 🔒 Security Features

Sentry is configured to automatically filter sensitive data:

- ✅ Passwords removed
- ✅ Tokens removed
- ✅ API keys removed
- ✅ Secrets removed
- ✅ Authorization headers removed
- ✅ Cookies removed
- ✅ Email addresses partially masked

## 📊 Features Enabled

### Performance Monitoring
- **Sample Rate:** 10% in production, 100% in development
- Tracks API route performance
- Tracks page load times
- Tracks database query performance

### Session Replay
- **Session Sample Rate:** 1% of sessions
- **Error Replay Rate:** 100% of errors
- Helps debug user experience issues
- Automatically masks sensitive data

### Error Aggregation
- Sentry automatically groups similar errors
- Shows error frequency and trends
- Tracks affected users

## 🎨 Sentry Dashboard

Once set up, you can:

1. **View Errors:** See all errors in real-time
2. **Error Details:** Full stack traces, user context, browser info
3. **Performance:** Monitor API response times
4. **Releases:** Track errors by deployment version
5. **Alerts:** Set up email/Slack notifications for critical errors

## 🔔 Setting Up Alerts (Optional)

1. Go to Sentry → Alerts
2. Create a new alert rule:
   - Trigger: When error count exceeds threshold
   - Actions: Email notification, Slack webhook, etc.
3. Configure alert conditions (e.g., "More than 10 errors in 5 minutes")

## 🚫 Ignored Errors

The following errors are automatically ignored (not sent to Sentry):

- Network errors (handled by retry logic)
- Browser extension errors
- User cancellation errors
- Timeout errors
- Service worker errors

You can customize this in `sentry.client.config.ts` and `sentry.server.config.ts`.

## 🧪 Testing

### Test in Development

Sentry is **disabled** in development mode. Errors are logged to console only.

### Test in Production

1. Build for production:
   ```bash
   npm run build
   ```

2. Start production server:
   ```bash
   npm start
   ```

3. Trigger a test error:
   ```typescript
   // In any component or API route
   throw new Error('Test error for Sentry')
   ```

4. Check Sentry dashboard - you should see the error!

## 📝 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Yes | Sentry DSN for client and server |
| `SENTRY_DSN` | No | Server-side DSN (can use NEXT_PUBLIC_SENTRY_DSN) |
| `SENTRY_ORG` | No | Organization name (for source maps) |
| `SENTRY_PROJECT` | No | Project name (for source maps) |
| `SENTRY_AUTH_TOKEN` | No | Auth token (for source maps upload) |

## 🔍 Troubleshooting

### "Sentry not capturing errors"

1. Check that `NEXT_PUBLIC_SENTRY_DSN` is set
2. Verify you're in production mode (`NODE_ENV=production`)
3. Check browser console for Sentry initialization errors
4. Verify DSN is correct (should start with `https://`)

### "Too many errors in Sentry"

1. Adjust `ignoreErrors` in Sentry config files
2. Increase `tracesSampleRate` to reduce performance monitoring
3. Adjust `replaysSessionSampleRate` to reduce session replays

### "Source maps not working"

1. Ensure `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are set
2. Run `npm run build` - source maps should upload automatically
3. Check `.sentryclirc` configuration

## 📚 Additional Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io/)
- [Sentry Best Practices](https://docs.sentry.io/product/best-practices/)

## ✅ Checklist

- [ ] Created Sentry account
- [ ] Created Next.js project in Sentry
- [ ] Added `NEXT_PUBLIC_SENTRY_DSN` to environment variables
- [ ] (Optional) Configured source maps upload
- [ ] (Optional) Set up alerting rules
- [ ] Tested error capture in production mode
- [ ] Verified errors appear in Sentry dashboard

## 🎉 You're Done!

Sentry is now fully integrated and ready to track errors in production. All errors logged via `logger.error()` and caught by error boundaries will automatically be sent to Sentry.
