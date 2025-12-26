# Booking Error Investigation

**Date:** December 11, 2024  
**Issue:** "Error creating booking: [Error: Failed to create booking]"  
**Status:** 🔍 **INVESTIGATING - Enhanced Logging Added**

---

## 🔍 **What I Found:**

The error message was too generic. It could be failing at multiple points:
1. ❌ Payment intent creation (Edge Function call)
2. ❌ Payment confirmation (Stripe)
3. ❌ Booking creation (after payment)

---

## ✅ **What I Fixed:**

### **1. Added Detailed Logging** (BookingForm.tsx)

**Before:**
```typescript
const response = await fetch(url, {...});
const data = await response.json();
if (!response.ok) {
  throw new Error(data.error || 'Failed to create payment intent');
}
```

**After:**
```typescript
logger.log('📞 Calling create-payment-intent endpoint...');
logger.log('📦 Request data:', { barberId, serviceId, date, ... });

const response = await fetch(url, {...});

logger.log('📡 Response status:', response.status, response.statusText);

const data = await response.json();
logger.log('📥 Response data:', data);

if (!response.ok) {
  logger.error('❌ Payment intent failed:', {
    status: response.status,
    error: data.error,
    details: data
  });
  throw new Error(data.error || 'Failed to create payment intent');
}
```

### **2. Enhanced Error Handling**

**Before:**
```typescript
} catch (error) {
  logger.error('Error creating booking:', error);
  Alert.alert('Error', 'Failed to create booking. Please try again.');
}
```

**After:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error('❌ Error creating booking:', {
    error: errorMessage,
    stack: error.stack,
    barberId,
    serviceId,
    selectedDate,
    selectedTime,
  });
  
  // Capture in Sentry with full context
  captureException(error, {
    context: 'BookingForm.handleBooking',
    selectedService,
    selectedBarber,
    selectedDate,
    selectedTime,
    errorMessage,
  });
  
  // Show detailed error to user
  Alert.alert('Booking Failed', errorMessage || 'Please try again');
}
```

---

## 🔍 **Next Time Error Happens - Look For:**

### **In Terminal Logs:**

You'll now see detailed logs like this:

**Success Case:**
```
📞 Calling create-payment-intent endpoint...
📦 Request data: {
  barberId: "abc-123",
  serviceId: "def-456",
  date: "2024-12-15T10:00:00Z",
  clientId: "user-789",
  paymentType: "fee",
  addonIds: []
}
📡 Response status: 200 OK
📥 Response data: {
  clientSecret: "pi_abc123_secret_def456",
  paymentIntentId: "pi_abc123",
  amount: 5338
}
✅ Payment intent created
```

**Error Case:**
```
📞 Calling create-payment-intent endpoint...
📦 Request data: {...}
📡 Response status: 400 Bad Request
📥 Response data: {
  error: "Developer accounts should use create-developer-booking endpoint"
}
❌ Payment intent failed: {
  status: 400,
  error: "Developer accounts should use create-developer-booking endpoint",
  details: {...}
}
ERROR Error creating booking: [Error: Developer accounts should use create-developer-booking endpoint]
```

---

## 🎯 **Possible Issues & Solutions:**

### **Issue 1: Developer Account Using Wrong Endpoint**

**Error:** "Developer accounts should use create-developer-booking endpoint"

**Solution:** The code already handles this! Check line 314-348 in BookingForm.tsx:
```typescript
if (isDeveloperAccount) {
  // Use create-developer-booking endpoint
} else {
  // Use create-payment-intent endpoint
}
```

**Fix:** Make sure `fetchBarberStatus()` is correctly detecting developer accounts:

<function_calls>
<invoke name="read_file">
<parameter name="target_file">/Users/yaseenkhalil/Downloads/barber-app-main/BocmApp/app/shared/components/BookingForm.tsx
