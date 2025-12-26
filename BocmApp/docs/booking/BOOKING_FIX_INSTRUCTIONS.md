# 🔧 Booking Fix Instructions

## Problem
The booking creation is failing with error: **"FOR UPDATE is not allowed with aggregate functions"**

This happens because the database trigger `check_booking_conflicts()` is using `COUNT(*)` with `FOR UPDATE`, which PostgreSQL doesn't allow.

## Solution

### Step 1: Apply the Database Migration

You need to run the migration file to fix the trigger function:

**Option A: Using Supabase CLI (Recommended)**
```bash
cd /Users/yaseenkhalil/Downloads/barber-app-main
supabase db push
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of:
   `supabase/migrations/20251212000001_fix_booking_trigger_for_update.sql`
4. Run the SQL

**Option C: Direct SQL Execution**
```bash
# Connect to your database and run:
psql $DATABASE_URL < supabase/migrations/20251212000001_fix_booking_trigger_for_update.sql
```

### Step 2: Verify the Fix

After applying the migration, try creating a booking again. The logs should now show:
- ✅ Payment intent created successfully
- ✅ Booking created successfully

## What the Fix Does

The migration changes the trigger function from:
```sql
-- ❌ OLD (BROKEN):
SELECT COUNT(*) INTO conflicting_count
FROM bookings ...
FOR UPDATE;  -- ERROR: Can't use FOR UPDATE with COUNT(*)
```

To:
```sql
-- ✅ NEW (FIXED):
SELECT b.id INTO conflicting_booking_id
FROM bookings ...
FOR UPDATE
LIMIT 1;  -- Lock one row, then check FOUND

IF FOUND THEN
    RAISE EXCEPTION 'Conflict detected';
END IF;
```

## Additional Checks

If bookings still fail after applying the migration, check:

1. **Barber Stripe Account Status**
   - The barber must have `stripe_account_id` set
   - The barber must have `stripe_account_status = 'active'`
   - Check in Supabase: `SELECT id, stripe_account_id, stripe_account_status FROM barbers WHERE id = 'your-barber-id'`

2. **Payment Intent Creation**
   - Check the logs for: `📞 Calling create-payment-intent endpoint...`
   - Check the response: `📡 Response status: 200 OK`
   - If you see `400` or `500`, check the error details

3. **Environment Variables**
   - `EXPO_PUBLIC_SUPABASE_URL` is set
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` is set
   - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set

## Testing

After applying the fix:
1. Try booking with a **developer account** (should work immediately)
2. Try booking with a **regular account** (should create payment intent)
3. Check the terminal logs for detailed error messages

## Next Steps

Once the migration is applied, the booking flow should work:
1. ✅ Payment intent created
2. ✅ User confirms payment
3. ✅ Booking created in database (trigger will work correctly)
4. ✅ Booking confirmation shown

