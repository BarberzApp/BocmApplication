# Supabase Edge Functions

This directory contains Edge Functions for the BOCM App (Barber On Call Mobile). Edge Functions are serverless functions that run on Supabase's infrastructure.

## Available Functions

- `stripe-connect`: Creates and manages Stripe Connect accounts for barbers (used in BarberOnboardingPage)
- `stripe-dashboard`: Generates Stripe dashboard login links for barbers (used in EarningsDashboard)
- `create-developer-booking`: Creates bookings for developer accounts without payment processing (used in BookingForm)
- `create-payment-intent`: Creates Stripe payment intents for regular bookings in the mobile app (used in BookingForm)

## Development

To develop Edge Functions locally:

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Start the local development environment:
   ```bash
   supabase start
   ```

3. Create a new function:
   ```bash
   supabase functions new my-function
   ```

4. Deploy a function:
   ```bash
   supabase functions deploy my-function
   ```

## Testing

To test functions locally:

```bash
supabase functions serve my-function
```

## Environment Variables

Functions can access environment variables set in the Supabase dashboard under Settings > Functions. 