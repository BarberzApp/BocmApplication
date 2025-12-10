# Loading & Error Handling Guide

## Overview

This guide covers the comprehensive loading and error handling system implemented to prevent app crashes and provide better user experience.

## 🚀 **New Features Implemented**

### 1. **Centralized Loading Provider**
- **File**: `src/shared/components/ui/loading-provider.tsx`
- **Purpose**: Manages global loading states and provides consistent loading indicators
- **Features**:
  - Global loading overlay with progress tracking
  - Auto-hide loading when auth status changes
  - `useAutoLoading` hook for automatic loading state management

### 2. **Enhanced Error Boundary**
- **File**: `src/shared/components/ui/enhanced-error-boundary.tsx`
- **Purpose**: Catches and handles errors with retry mechanisms
- **Features**:
  - Automatic retry with exponential backoff
  - Context-aware error messages (auth, network, etc.)
  - Development error details
  - Multiple recovery options (retry, go home, go back, refresh)

### 3. **Network Utilities**
- **File**: `src/shared/lib/network-utils.ts`
- **Purpose**: Provides robust API call handling with timeouts and retries
- **Features**:
  - Timeout handling for all API calls
  - Retry logic with exponential backoff
  - Network status monitoring
  - Enhanced Supabase query wrapper
  - Session-aware API calls

## 🔧 **How to Use**

### **Loading States**

```typescript
import { useLoading, useAutoLoading } from '@/shared/components/ui/loading-provider'

// Manual loading control
function MyComponent() {
  const { showLoading, hideLoading } = useLoading()
  
  const handleAction = async () => {
    showLoading('Processing...', true) // Global loading
    try {
      await someAsyncOperation()
    } finally {
      hideLoading()
    }
  }
}

// Automatic loading with useAutoLoading
function MyComponent() {
  const { execute, isLoading, error } = useAutoLoading(
    async (param: string) => {
      return await apiCall(param)
    },
    'Loading data...',
    false // Local loading
  )
  
  const handleClick = async () => {
    const result = await execute('some-param')
    if (result) {
      // Handle success
    }
  }
}
```

### **Error Handling**

```typescript
import { useErrorHandler } from '@/shared/components/ui/enhanced-error-boundary'

function MyComponent() {
  const { error, handleError, retryError, resetError } = useErrorHandler()
  
  const handleAction = async () => {
    try {
      await riskyOperation()
    } catch (err) {
      handleError(err as Error)
    }
  }
  
  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={retryError}>Try Again</button>
        <button onClick={resetError}>Reset</button>
      </div>
    )
  }
}
```

### **Network Calls**

```typescript
import { 
  safeSupabaseQuery, 
  authenticatedApiCall, 
  withTimeout, 
  withRetry 
} from '@/shared/lib/network-utils'

// Safe Supabase query
const data = await safeSupabaseQuery(
  () => supabase.from('table').select('*'),
  { timeout: 5000, retries: 3 }
)

// Authenticated API call
const result = await authenticatedApiCall(
  async (userId: string) => {
    return await fetch(`/api/user/${userId}`)
  },
  { timeout: 10000, retries: 2 }
)

// Manual timeout and retry
const result = await withRetry(
  () => withTimeout(someAsyncOperation(), 5000),
  3, // max retries
  1000 // base delay
)
```

## 🛠 **Best Practices**

### **1. Always Use Loading States**
```typescript
// ❌ Bad - No loading state
const handleSubmit = async () => {
  await apiCall()
}

// ✅ Good - With loading state
const { execute, isLoading } = useAutoLoading(apiCall, 'Submitting...')
const handleSubmit = () => execute()
```

### **2. Handle Errors Gracefully**
```typescript
// ❌ Bad - Let errors bubble up
const data = await apiCall()

// ✅ Good - Handle errors
try {
  const data = await safeSupabaseQuery(() => apiCall())
} catch (error) {
  console.error('API call failed:', error)
  // Show user-friendly error message
}
```

### **3. Use Timeouts for All API Calls**
```typescript
// ❌ Bad - No timeout
const response = await fetch('/api/data')

// ✅ Good - With timeout
const response = await safeFetch('/api/data', { timeout: 10000 })
```

### **4. Implement Retry Logic**
```typescript
// ❌ Bad - No retry
const data = await apiCall()

// ✅ Good - With retry
const data = await withRetry(() => apiCall(), 3, 1000)
```

## 🔍 **Common Issues & Solutions**

### **Issue 1: Infinite Loading**
**Cause**: Loading state not properly reset
**Solution**: Always use try/finally or useAutoLoading hook

```typescript
// ✅ Proper loading state management
const { execute, isLoading } = useAutoLoading(apiCall, 'Loading...')
```

### **Issue 2: Network Timeouts**
**Cause**: No timeout handling
**Solution**: Use safeFetch or withTimeout

```typescript
// ✅ With timeout
const response = await safeFetch('/api/data', { timeout: 10000 })
```

### **Issue 3: Auth Errors**
**Cause**: Session expired or invalid
**Solution**: Use authenticatedApiCall wrapper

```typescript
// ✅ Session-aware API call
const result = await authenticatedApiCall(async (userId) => {
  return await apiCall(userId)
})
```

### **Issue 4: Race Conditions**
**Cause**: Multiple simultaneous API calls
**Solution**: Use debounce or throttle

```typescript
import { debounce } from '@/shared/lib/network-utils'

const debouncedSearch = debounce(async (query: string) => {
  return await searchAPI(query)
}, 300)
```

## 📊 **Monitoring & Debugging**

### **Error Logging**
- All errors are logged to console in development
- Production errors should be sent to external service (Sentry, LogRocket)
- Network errors are automatically retried with exponential backoff

### **Performance Monitoring**
- Loading times are tracked automatically
- Network status is monitored
- Timeout errors are logged with context

### **Debug Tools**
- Development mode shows detailed error information
- Network status indicator
- Loading state debugging

## 🚨 **Emergency Recovery**

### **Auto-Recovery Features**
1. **Session Recovery**: Automatic session refresh on auth errors
2. **Network Recovery**: Retry on network failures
3. **Component Recovery**: Error boundary retry mechanisms

### **Manual Recovery Options**
1. **Retry**: Attempt the operation again
2. **Go Home**: Navigate to home page
3. **Go Back**: Navigate to previous page
4. **Refresh**: Reload the entire page

## 📝 **Migration Guide**

### **Updating Existing Components**

1. **Replace manual loading states**:
```typescript
// Old
const [loading, setLoading] = useState(false)
const handleAction = async () => {
  setLoading(true)
  try {
    await apiCall()
  } finally {
    setLoading(false)
  }
}

// New
const { execute, isLoading } = useAutoLoading(apiCall, 'Processing...')
const handleAction = () => execute()
```

2. **Replace manual error handling**:
```typescript
// Old
try {
  await apiCall()
} catch (error) {
  console.error(error)
  // Manual error handling
}

// New
const { execute, error } = useAutoLoading(apiCall, 'Loading...')
if (error) {
  // Error is automatically handled
}
```

3. **Replace manual API calls**:
```typescript
// Old
const response = await fetch('/api/data')

// New
const response = await safeFetch('/api/data', { timeout: 10000 })
```

## 🎯 **Testing**

### **Loading State Testing**
```typescript
import { render, screen } from '@testing-library/react'
import { LoadingProvider } from '@/shared/components/ui/loading-provider'

test('shows loading state', () => {
  render(
    <LoadingProvider>
      <MyComponent />
    </LoadingProvider>
  )
  
  // Test loading states
})
```

### **Error Handling Testing**
```typescript
test('handles errors gracefully', () => {
  render(
    <EnhancedErrorBoundary>
      <ComponentThatThrows />
    </EnhancedErrorBoundary>
  )
  
  // Test error recovery
})
```

## 🔮 **Future Improvements**

1. **Error Reporting**: Integrate with Sentry or LogRocket
2. **Performance Monitoring**: Add performance metrics
3. **Offline Support**: Implement offline-first features
4. **Progressive Loading**: Add skeleton screens and progressive loading
5. **Smart Retries**: Implement intelligent retry strategies based on error types

---

This comprehensive loading and error handling system should significantly reduce app crashes and improve user experience by providing consistent, reliable error recovery mechanisms. 