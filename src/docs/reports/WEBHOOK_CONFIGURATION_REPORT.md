# Stripe Webhook Configuration Report

**Generated:** December 17, 2025

## Executive Summary

✅ **Webhook events are being delivered by Stripe**  
❌ **Webhook endpoints are pointing to incorrect/outdated URLs**  
⚠️ **Bookings are not being created because webhooks are going to wrong endpoints**

## Current Status

### Environment Variables
- ✅ `STRIPE_SECRET_KEY`: Configured
- ✅ `STRIPE_WEBHOOK_SECRET`: Configured
- 📱 App URL: `https://a29a16f65a82.ngrok-free.app` (current ngrok URL)

### Webhook Endpoints in Stripe

**Found 2 webhook endpoints (both pointing to wrong URLs):**

1. **Old ngrok URL** (6 events configured)
   - URL: `https://08a3-108-24-111-88.ngrok-free.app/api/webhooks/stripe`
   - Status: ✅ Enabled
   - ⚠️ **This is an old ngrok URL that's no longer active**

2. **Vercel URL** (4 events configured)
   - URL: `https://barber-app-five.vercel.app/api/stripe/webhook`
   - Status: ✅ Enabled
   - ❌ **Wrong path! Should be `/api/webhooks/stripe` not `/api/stripe/webhook`**

### Expected Configuration

**Correct webhook URL should be:**
```
https://a29a16f65a82.ngrok-free.app/api/webhooks/stripe
```
(For production, this should be your production domain, e.g., `https://bocmstyle.com/api/webhooks/stripe`)

### Recent Webhook Events

**Found 7 recent `payment_intent.succeeded` events, including:**
- ✅ Event `evt_3SfW6CE7kvTS9PZe1xi4d78y` for payment `pi_3SfW6CE7kvTS9PZe1kXhACIw`
- Status: ✅ Delivered (but to wrong endpoint)
- Created: December 17, 2025, 8:33:49 PM

**The webhook was delivered, but to an endpoint that doesn't exist or isn't responding correctly.**

## Required Events

The webhook endpoint should listen for these events:

1. ✅ `payment_intent.succeeded` - **CRITICAL** - Creates bookings
2. ✅ `payment_intent.payment_failed` - Updates booking status
3. ✅ `charge.refunded` - Handles refunds
4. ✅ `checkout.session.completed` - Updates booking status
5. ✅ `checkout.session.expired` - Updates booking status
6. ✅ `account.created` - Stripe Connect onboarding
7. ✅ `account.updated` - Stripe Connect status updates
8. ✅ `account.application.deauthorized` - Handles deauthorization

## Issues Found

### 1. Webhook Endpoints Point to Wrong URLs
- Old ngrok URLs are no longer active
- Vercel endpoint has wrong path (`/api/stripe/webhook` instead of `/api/webhooks/stripe`)

### 2. Missing Production Endpoint
- No webhook endpoint configured for production domain
- Need to add endpoint for `https://bocmstyle.com/api/webhooks/stripe` (or your production URL)

## How to Fix

### Option 1: Update Existing Endpoints (Recommended for Development)

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. For each endpoint:
   - Click on the endpoint
   - Click "Update endpoint"
   - Change URL to: `https://a29a16f65a82.ngrok-free.app/api/webhooks/stripe` (or your current ngrok URL)
   - Ensure all required events are selected
   - Save

### Option 2: Create New Endpoint (Recommended for Production)

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set URL to your production URL:
   ```
   https://bocmstyle.com/api/webhooks/stripe
   ```
   (Or your actual production domain)
4. Select all required events (see list above)
5. Copy the "Signing secret"
6. Set it as `STRIPE_WEBHOOK_SECRET` in your production environment variables

### Option 3: Use Stripe CLI for Local Development

```bash
# Install Stripe CLI if not already installed
# Then run:
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# This will give you a webhook signing secret
# Use it as STRIPE_WEBHOOK_SECRET for local development
```

## Verification Steps

After updating webhook configuration:

1. **Test webhook delivery:**
   ```bash
   node scripts/check-webhook-config.js
   ```

2. **Check webhook logs in Stripe Dashboard:**
   - Go to [Stripe Dashboard → Webhooks → Your Endpoint → Events](https://dashboard.stripe.com/webhooks)
   - Look for recent `payment_intent.succeeded` events
   - Check if they show "✅ Succeeded" or "❌ Failed"

3. **Check application logs:**
   - Look for webhook processing logs
   - Check for any errors in booking creation

4. **Verify booking creation:**
   ```bash
   node scripts/check-booking-by-payment-intent.js <payment-intent-id>
   ```

## Production Checklist

- [ ] Create webhook endpoint for production domain
- [ ] Configure all required events
- [ ] Set `STRIPE_WEBHOOK_SECRET` in production environment
- [ ] Test webhook delivery with a test payment
- [ ] Verify booking creation works
- [ ] Monitor webhook logs for errors
- [ ] Set up alerts for webhook failures

## Additional Notes

- The webhook handler code is located at: `src/app/api/webhooks/stripe/route.ts`
- The handler properly validates webhook signatures
- The handler creates bookings from payment intent metadata
- If webhooks fail, bookings won't be created automatically
- You can manually create bookings using: `scripts/manually-create-booking-from-payment.js`

## Next Steps

1. **Immediate:** Update webhook endpoints to point to correct URLs
2. **Short-term:** Set up production webhook endpoint
3. **Long-term:** Monitor webhook delivery and set up alerts

---

**Scripts Available:**
- `scripts/check-webhook-config.js` - Check webhook configuration
- `scripts/check-booking-by-payment-intent.js` - Check if booking exists for payment intent
- `scripts/manually-create-booking-from-payment.js` - Manually create booking from payment intent

