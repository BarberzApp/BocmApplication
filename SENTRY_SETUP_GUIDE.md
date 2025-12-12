# Sentry Setup Guide for BocmApp

**Date:** December 11, 2024  
**Status:** ✅ Code integrated, needs Sentry account setup

---

## 🎯 What's Been Done

### **1. Sentry Package Installed** ✅
```bash
npm install --save @sentry/react-native
```

### **2. Sentry Integration Code Added** ✅

**Files Created/Modified:**
- ✅ `app/shared/lib/sentry.ts` - Sentry configuration and utilities
- ✅ `App.tsx` - Sentry initialization
- ✅ `app/shared/hooks/useAuth.tsx` - User context tracking
- ✅ `sentry.properties` - Sentry configuration file

### **3. Features Implemented** ✅
- ✅ Error tracking
- ✅ User context tracking
- ✅ Breadcrumb logging
- ✅ Production-only mode (disabled in development)
- ✅ Sensitive data filtering
- ✅ Network error filtering

---

## 🚀 Next Steps - Create Sentry Account (10 minutes)

### **Step 1: Create Sentry Account** (2 minutes)

1. Go to [https://sentry.io/signup/](https://sentry.io/signup/)
2. Sign up with your email or GitHub
3. Choose the **Free Plan** (good for beta testing)
   - 5,000 errors/month
   - 10,000 transactions/month
   - 30-day retention
   - **Perfect for beta launch!**

### **Step 2: Create a Project** (3 minutes)

1. After signup, click "Create Project"
2. Choose platform: **React Native**
3. Set alert frequency: **On every new issue** (for beta)
4. Project name: `bocm-app` or `BocmApp`
5. Click "Create Project"

### **Step 3: Get Your DSN** (1 minute)

After creating the project, you'll see a DSN (Data Source Name) that looks like:

```
https://abc123def456@o123456.ingest.sentry.io/789012
```

**Copy this DSN!** You'll need it in the next step.

### **Step 4: Add DSN to Your App** (2 minutes)

1. Open `/BocmApp/.env` (or create it if it doesn't exist)
2. Add this line:

```bash
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn-here@o123456.ingest.sentry.io/789012
```

**Example:**
```bash
# Existing env vars
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

# Add Sentry DSN
EXPO_PUBLIC_SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/789012
```

### **Step 5: Update sentry.properties** (2 minutes)

1. Open `/BocmApp/sentry.properties`
2. Update with your Sentry details:

```properties
defaults.url=https://sentry.io/
defaults.org=your-organization-name
defaults.project=bocm-app

# Optional: Add auth token for source maps (can do later)
# auth.token=YOUR_SENTRY_AUTH_TOKEN
```

**How to find your org name:**
- Look at your Sentry URL: `https://sentry.io/organizations/YOUR-ORG-NAME/`

---

## ✅ Verify Setup (5 minutes)

### **Test in Development:**

1. Start your app:
```bash
cd BocmApp
npx expo start
```

2. Check the logs - you should see:
```
🔧 Development mode: Sentry disabled (errors logged to console)
```

**This is correct!** Sentry is disabled in development to avoid noise.

### **Test in Production Mode:**

1. Build for production:
```bash
# For iOS
npx expo run:ios --configuration Release

# For Android
npx expo run:android --variant release
```

2. Check the logs - you should see:
```
✅ Sentry initialized successfully
```

3. Trigger a test error (optional):
```typescript
// Add this temporarily to any page
throw new Error('Test error for Sentry');
```

4. Check your Sentry dashboard - you should see the error appear!

---

## 📊 What Sentry Will Track

### **Automatically Tracked:**
- ✅ JavaScript errors
- ✅ Unhandled promise rejections
- ✅ Native crashes (iOS/Android)
- ✅ User context (ID, email)
- ✅ Breadcrumbs (user actions)
- ✅ Device info (OS, version, model)
- ✅ App version

### **Filtered Out:**
- ❌ Network errors (we handle these)
- ❌ Timeout errors (we handle these)
- ❌ User cancelled actions
- ❌ Passwords, tokens, secrets
- ❌ Development errors (only production)

---

## 🎯 Using Sentry in Your Code

### **1. Capture Exceptions:**

```typescript
import { captureException } from '../shared/lib/sentry';

try {
  // Your code
} catch (error) {
  captureException(error as Error, {
    context: 'booking',
    userId: user.id,
  });
}
```

### **2. Capture Messages:**

```typescript
import { captureMessage } from '../shared/lib/sentry';

captureMessage('Payment processing started', 'info', {
  amount: 50,
  userId: user.id,
});
```

### **3. Add Breadcrumbs:**

```typescript
import { addBreadcrumb } from '../shared/lib/sentry';

addBreadcrumb('User clicked book button', 'user-action', {
  barberId: barber.id,
  serviceId: service.id,
});
```

### **4. Wrap Functions:**

```typescript
import { withSentry } from '../shared/lib/sentry';

const processPayment = withSentry(async (amount: number) => {
  // Your code - errors automatically captured
});
```

---

## 📱 Sentry Dashboard Overview

### **What You'll See:**

1. **Issues Tab:**
   - All errors grouped by type
   - Frequency and user impact
   - Stack traces
   - User context

2. **Performance Tab:**
   - Transaction traces
   - Slow operations
   - API call performance

3. **Releases Tab:**
   - Errors by app version
   - Deployment tracking

4. **Alerts:**
   - Email/Slack notifications
   - Custom alert rules

---

## 🔔 Recommended Alert Settings (For Beta)

### **Go to Project Settings → Alerts:**

1. **Create Alert Rule:**
   - Name: "New Error in Production"
   - Conditions: "A new issue is created"
   - Actions: "Send notification to email"
   - Environment: "production"

2. **Create Alert Rule:**
   - Name: "High Error Volume"
   - Conditions: "Event count is above 10 in 1 hour"
   - Actions: "Send notification to email"
   - Environment: "production"

3. **Create Alert Rule:**
   - Name: "Critical Error"
   - Conditions: "Issue level is fatal"
   - Actions: "Send notification to email immediately"
   - Environment: "production"

---

## 🎯 Beta Launch Monitoring Strategy

### **Week 1 (Daily):**
- [ ] Check Sentry dashboard every morning
- [ ] Review new errors
- [ ] Fix critical issues immediately
- [ ] Monitor error frequency

### **Week 2-4 (Every 2-3 days):**
- [ ] Review error trends
- [ ] Fix high-frequency errors
- [ ] Monitor performance issues
- [ ] Update alert rules

---

## 💡 Pro Tips

### **1. Use Environments:**
```typescript
// In sentry.ts, we already set this:
environment: isProduction ? 'production' : 'development'
```

This lets you filter errors by environment in Sentry.

### **2. Use Releases:**
```bash
# When deploying, tag your release
npx sentry-cli releases new 1.0.0
npx sentry-cli releases finalize 1.0.0
```

This helps track which version has which errors.

### **3. Source Maps (Optional):**
```bash
# Upload source maps for better stack traces
npx sentry-cli sourcemaps upload --release 1.0.0 ./dist
```

### **4. User Feedback:**
```typescript
// Let users report issues
import Sentry from '@sentry/react-native';

Sentry.showReportDialog({
  eventId: 'error-id',
  user: {
    email: user.email,
    name: user.name,
  },
});
```

---

## 🚨 Common Issues & Solutions

### **Issue: "Sentry DSN not configured"**
**Solution:** Add `EXPO_PUBLIC_SENTRY_DSN` to your `.env` file

### **Issue: "Sentry not capturing errors"**
**Solution:** 
- Check you're in production mode
- Verify DSN is correct
- Check Sentry dashboard for rate limits

### **Issue: "Too many errors"**
**Solution:**
- Update `ignoreErrors` in `sentry.ts`
- Add more specific error filters
- Fix the underlying issues!

### **Issue: "Sensitive data in errors"**
**Solution:**
- Update `beforeSend` hook in `sentry.ts`
- Add more field filters
- Review error context

---

## 📊 Cost Estimation

### **Free Plan (Recommended for Beta):**
- 5,000 errors/month
- 10,000 transactions/month
- 30-day retention
- **Cost: $0**

**Estimated Usage for 50 Beta Users:**
- ~500-1,000 errors/month (if app is stable)
- ~5,000 transactions/month
- **Well within free tier!**

### **Team Plan (If Needed Later):**
- 50,000 errors/month
- 100,000 transactions/month
- 90-day retention
- **Cost: $26/month**

---

## ✅ Checklist

### **Setup (10 minutes):**
- [ ] Create Sentry account
- [ ] Create project
- [ ] Get DSN
- [ ] Add DSN to `.env`
- [ ] Update `sentry.properties`

### **Verification (5 minutes):**
- [ ] Start app in dev mode (should see "Sentry disabled")
- [ ] Build for production
- [ ] Check logs (should see "Sentry initialized")
- [ ] Trigger test error (optional)
- [ ] Verify error appears in dashboard

### **Configuration (5 minutes):**
- [ ] Set up email alerts
- [ ] Configure alert rules
- [ ] Invite team members (if any)
- [ ] Set up Slack integration (optional)

---

## 🎉 You're Done!

**Total Time:** ~20 minutes

**What You Get:**
- ✅ Real-time error monitoring
- ✅ User context tracking
- ✅ Performance monitoring
- ✅ Email alerts
- ✅ Production-ready setup

**Next Steps:**
1. Complete Sentry setup (20 min)
2. Test on real devices (1 hour)
3. Create feedback channel (30 min)
4. **LAUNCH BETA!** 🚀

---

## 📞 Support

**Sentry Docs:** [https://docs.sentry.io/platforms/react-native/](https://docs.sentry.io/platforms/react-native/)

**Sentry Support:** [https://sentry.io/support/](https://sentry.io/support/)

**BocmApp Sentry Config:** `/BocmApp/app/shared/lib/sentry.ts`

---

## 🎯 Bottom Line

**Sentry is now integrated into your app!**

Just need to:
1. Create Sentry account (2 min)
2. Get DSN (1 min)
3. Add to `.env` (1 min)
4. **Done!** ✅

**You're one step closer to beta launch!** 🚀

