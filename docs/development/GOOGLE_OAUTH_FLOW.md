# Google OAuth Flow Documentation

## Overview

This document explains the complete Google OAuth authentication flow in the BOCM app, including the proper order of operations, error handling, and state management.

## 🔄 **Complete Flow Sequence**

### **1. User Initiates Google Sign-In**
- User clicks "Sign in with Google" button
- Redirects to Google OAuth consent screen
- User authorizes the app

### **2. Google Redirects to Callback**
- Google redirects to `/auth/callback` with authorization code
- Middleware intercepts and exchanges code for session
- Session is established in Supabase

### **3. Auth Callback Page Processing**
The callback page (`/auth/callback`) now follows this exact sequence:

#### **Step 1: Session Validation**
```typescript
// Get and validate session
const { data: { session }, error: sessionError } = await supabase.auth.getSession()
if (sessionError || !session?.user) {
  throw new Error('No session found')
}
```

#### **Step 2: Profile Fetch with Retry**
```typescript
// Fetch profile with 3 retry attempts
let profile = null
let retries = 3

while (retries > 0) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, username, location, email, business_name')
    .eq('id', userId)
    .single()
  
  if (data) {
    profile = data
    break
  }
  
  retries--
  if (retries > 0) {
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}
```

#### **Step 3: Profile Completion Check**
```typescript
// Check if profile needs completion
if (!profile.role || !profile.username) {
  router.replace('/register/complete')
  return
}
```

#### **Step 4: Barber Row Creation (if needed)**
```typescript
// Ensure barber row exists for barber users
if (profile.role === 'barber') {
  const { data: existingBarber } = await supabase
    .from('barbers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existingBarber) {
    await supabase.from('barbers').insert({
      user_id: userId,
      business_name: profile.business_name || '',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
}
```

#### **Step 5: Redirect Decision**
```typescript
// Determine appropriate redirect path
let redirectPath = '/'

if (profile.email === 'primbocm@gmail.com') {
  redirectPath = '/super-admin'
} else if (profile.role === 'barber') {
  redirectPath = '/barber/onboarding'
} else if (profile.location) {
  redirectPath = '/browse'
} else {
  redirectPath = '/client/onboarding'
}
```

## 🛠️ **Key Improvements Made**

### **1. Proper Order of Operations**
- ✅ **Session validation** before any database operations
- ✅ **Profile fetching** with retry mechanism
- ✅ **Role/username validation** before proceeding
- ✅ **Barber row creation** for barber users
- ✅ **State setting** before redirect

### **2. Enhanced Error Handling**
- ✅ **Retry mechanism** for profile fetching
- ✅ **Detailed error logging** with emojis for easy debugging
- ✅ **Graceful error recovery** with user-friendly messages
- ✅ **Automatic redirect** to login on failure

### **3. Better User Experience**
- ✅ **Status indicators** showing current step
- ✅ **Progress feedback** with different icons and messages
- ✅ **Success confirmation** before redirect
- ✅ **Error details** displayed to user

### **4. Robust State Management**
- ✅ **Multiple status states** (verifying, completing, redirecting, error)
- ✅ **Proper cleanup** on component unmount
- ✅ **Consistent error boundaries**

## 🔧 **Technical Implementation**

### **Auth Callback Page (`/auth/callback`)**
- **File**: `src/app/auth/callback/page.tsx`
- **Purpose**: Handles OAuth callback and user state setup
- **Key Features**:
  - Session validation with retry
  - Profile completion check
  - Barber row creation
  - Smart redirect logic
  - Comprehensive error handling

### **Registration Completion Page (`/register/complete`)**
- **File**: `src/app/(routes)/register/complete/page.tsx`
- **Purpose**: Allows users to complete their profile setup
- **Key Features**:
  - Role selection (client/barber)
  - Username creation
  - Barber row creation for barber users
  - Validation and error handling

### **Middleware Integration**
- **File**: `middleware.ts`
- **Purpose**: Handles session exchange and validation
- **Key Features**:
  - Code-to-session exchange
  - Session refresh handling
  - Error recovery

## 🚨 **Error Scenarios & Recovery**

### **1. Session Creation Failure**
- **Cause**: Invalid OAuth code or network issues
- **Recovery**: Redirect to login with error message
- **User Action**: Retry Google sign-in

### **2. Profile Fetch Failure**
- **Cause**: Database connection issues or missing profile
- **Recovery**: 3 retry attempts with 1-second delays
- **Fallback**: Redirect to login if all retries fail

### **3. Barber Row Creation Failure**
- **Cause**: Database constraints or permission issues
- **Recovery**: Log error and continue (user can complete later)
- **Fallback**: User completes setup in onboarding

### **4. Incomplete Profile**
- **Cause**: Missing role or username
- **Recovery**: Redirect to `/register/complete`
- **User Action**: Complete profile setup

## 📊 **Debugging & Monitoring**

### **Console Logging**
The callback page includes comprehensive logging:
```typescript
console.log('🔐 Starting Google OAuth callback process...')
console.log('✅ Session validated for user:', userId)
console.log('📋 Fetching profile - Attempt 1/3...')
console.log('💈 Checking for barber row...')
console.log('🎯 Redirecting to:', redirectPath)
```

### **Status Tracking**
- **verifying**: Session validation in progress
- **completing**: Profile setup and barber row creation
- **redirecting**: Final redirect preparation
- **error**: Error state with recovery options

### **Error Reporting**
- Detailed error messages with context
- User-friendly error display
- Automatic error recovery with timeouts

## 🔄 **State Synchronization**

### **Auth Store Integration**
The auth store (`src/shared/stores/auth-store.ts`) also includes barber row creation logic as a backup:

```typescript
// Ensure barber row exists after confirmation
if (profile.role === 'barber') {
  const { data: barber } = await supabase
    .from('barbers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (!barber) {
    await supabase.from('barbers').insert({
      user_id: userId,
      business_name: profile.business_name || '',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}
```

This ensures that even if the callback page fails to create the barber row, the auth store will handle it during the next profile fetch.

## ✅ **Testing Checklist**

### **Client Flow**
- [ ] Google sign-in works
- [ ] Profile completion page appears for new users
- [ ] Redirect to client onboarding after completion
- [ ] Redirect to browse if location exists

### **Barber Flow**
- [ ] Google sign-in works
- [ ] Profile completion page appears for new users
- [ ] Barber row is created during completion
- [ ] Redirect to barber onboarding after completion

### **Error Scenarios**
- [ ] Network failure during profile fetch
- [ ] Database error during barber row creation
- [ ] Invalid OAuth code handling
- [ ] Session expiration handling

### **Edge Cases**
- [ ] User with existing profile but no role
- [ ] User with role but no username
- [ ] Barber user without barber row
- [ ] Super admin email handling

## 🎯 **Best Practices**

1. **Always validate session** before database operations
2. **Use retry mechanisms** for network-dependent operations
3. **Provide clear user feedback** at each step
4. **Handle errors gracefully** with recovery options
5. **Log operations** for debugging and monitoring
6. **Ensure data consistency** across all user states
7. **Test edge cases** thoroughly
8. **Monitor error rates** in production

This implementation ensures a robust, user-friendly OAuth flow that handles all edge cases and provides clear feedback throughout the process. 