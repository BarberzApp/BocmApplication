# EAS Build Quick Start

## ✅ Configuration Complete!

Your `eas.json` and `app.json` are now configured for production builds.

## Step 1: Set Environment Variables

Run these commands to set up your environment variables in EAS:

```bash
cd BocmApp

# Set Supabase URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL"

# Set Supabase Anon Key
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_SUPABASE_ANON_KEY"

# Set Stripe Publishable Key
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "YOUR_STRIPE_PUBLISHABLE_KEY"

# Set Sentry DSN (optional but recommended)
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "YOUR_SENTRY_DSN"
```

**Replace the placeholder values with your actual keys!**

## Step 2: Verify Secrets

Check that your secrets are set:

```bash
eas env:list --environment production
```

## Step 3: Build the App

### Option A: Preview Build (Internal Testing)

Build for internal testing (APK/IPA):

```bash
# iOS Preview
eas build --platform ios --profile preview

# Android Preview  
eas build --platform android --profile preview

# Both platforms
eas build --platform all --profile preview
```

### Option B: Production Build (App Store/Play Store)

Build for production:

```bash
# iOS Production
eas build --platform ios --profile production

# Android Production
eas build --platform android --profile production

# Both platforms
eas build --platform all --profile production
```

## Step 4: Monitor Build

Check build status:

```bash
# List all builds
eas build:list

# View specific build details
eas build:view [build-id]
```

## Step 5: Download Build

Once build completes:

```bash
eas build:download [build-id]
```

## Step 6: Submit to Stores (Optional)

After testing, submit to app stores:

```bash
# iOS App Store
eas submit --platform ios --latest

# Android Google Play
eas submit --platform android --latest
```

## Troubleshooting

### If build fails with missing env vars:

1. Check secrets:
   ```bash
   eas env:list --environment production
   ```

2. Update a secret:
   ```bash
   eas secret:delete EXPO_PUBLIC_SUPABASE_URL
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "new-value"
   ```

### If you need to update EAS CLI:

```bash
npm install -g eas-cli@latest
```

## What's Configured

✅ **iOS:**
- Bundle ID: `com.yaskhalil.bocm`
- Production push notifications enabled
- App Store submission configured

✅ **Android:**
- Package: `com.yaskhalil.bocm`
- Production builds as AAB (App Bundle)
- Preview builds as APK

✅ **Build Profiles:**
- `development`: Dev client builds
- `preview`: Internal testing (APK/IPA)
- `production`: App Store/Play Store ready

## Next Steps

1. ✅ Set environment variables (Step 1)
2. ✅ Build preview version (Step 3 - Option A)
3. ✅ Test on real devices
4. ✅ Build production version (Step 3 - Option B)
5. ✅ Submit to stores (Step 6)

---

**Ready to build?** Start with Step 1 above! 🚀

