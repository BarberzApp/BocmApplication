# EAS Build Guide for BocmApp

## Prerequisites

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Verify Project**:
   ```bash
   cd BocmApp
   eas whoami
   ```

## Required Environment Variables

The app requires these environment variables to be set in EAS:

### Required:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key

### Optional (but recommended):
- `EXPO_PUBLIC_SENTRY_DSN` - Sentry DSN for error tracking

## Setting Up Environment Variables

### Option 1: Using EAS Secrets (Recommended)

Set secrets for production builds:

```bash
# Supabase
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-supabase-url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-supabase-anon-key"

# Stripe
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "your-stripe-publishable-key"

# Sentry (optional)
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "your-sentry-dsn"
```

### Option 2: Using .env file (for local development)

Create a `.env` file in the `BocmApp` directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

**Note:** `.env` files are gitignored and won't be included in builds. Use EAS secrets for production.

## Building the App

### 1. Preview Build (Internal Testing)

Build for internal testing:

```bash
# iOS Preview
eas build --platform ios --profile preview

# Android Preview
eas build --platform android --profile preview

# Both platforms
eas build --platform all --profile preview
```

### 2. Production Build (App Store/Play Store)

Build for production:

```bash
# iOS Production
eas build --platform ios --profile production

# Android Production
eas build --platform android --profile production

# Both platforms
eas build --platform all --profile production
```

### 3. Development Build (with Dev Client)

For development with Expo Dev Client:

```bash
eas build --platform ios --profile development
eas build --platform android --profile development
```

## Build Profiles Explained

- **development**: Development build with Expo Dev Client
- **preview**: Internal testing build (APK for Android, IPA for iOS)
- **production**: Production build for App Store/Play Store submission

## Checking Build Status

```bash
# List all builds
eas build:list

# View specific build
eas build:view [build-id]

# Download build
eas build:download [build-id]
```

## Submitting to App Stores

### iOS (App Store)

```bash
# Build and submit to App Store
eas submit --platform ios --profile production

# Or submit existing build
eas submit --platform ios --latest
```

### Android (Google Play)

```bash
# Build and submit to Google Play
eas submit --platform android --profile production

# Or submit existing build
eas submit --platform android --latest
```

**Note:** For Android, you'll need a Google Service Account JSON file. Place it at `./google-service-account.json` (already configured in `eas.json`).

## Troubleshooting

### Build Fails with Missing Environment Variables

1. Check secrets are set:
   ```bash
   eas secret:list
   ```

2. Verify secrets are correct:
   ```bash
   eas secret:view EXPO_PUBLIC_SUPABASE_URL
   ```

3. Update secret if needed:
   ```bash
   eas secret:delete EXPO_PUBLIC_SUPABASE_URL
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "new-value"
   ```

### Build Takes Too Long

- Use `--local` flag to build locally (requires native development setup):
  ```bash
  eas build --platform ios --profile production --local
  ```

### Check Build Logs

```bash
eas build:view [build-id] --logs
```

## Quick Start Commands

```bash
# 1. Set up secrets (one time)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "YOUR_VALUE"

# 2. Build for preview (internal testing)
eas build --platform all --profile preview

# 3. Build for production (App Store/Play Store)
eas build --platform all --profile production

# 4. Submit to stores (after build completes)
eas submit --platform ios --latest
eas submit --platform android --latest
```

## Next Steps

1. ✅ Set up EAS secrets
2. ✅ Build preview version for testing
3. ✅ Test on real devices
4. ✅ Build production version
5. ✅ Submit to App Store/Play Store

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Environment Variables Guide](https://docs.expo.dev/build-reference/variables/)

