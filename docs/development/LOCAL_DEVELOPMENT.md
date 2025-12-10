# Local Development Guide

This guide helps you set up and run the Barber App locally, including Stripe Connect and Supabase integration.

## Prerequisites
- Node.js (see `package.json` for version)
- npm
- Supabase account & CLI (for local DB, optional)
- Stripe account (for payments)
- [ngrok](https://ngrok.com/) or Stripe CLI (for local webhook testing)

## Environment Variables
See the main `README.md` for required environment variables. Example:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

## Running the App Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```

## Stripe Connect & Webhooks (Local)
- Stripe requires a public URL for webhooks. Use ngrok or Stripe CLI to tunnel your local server:
  ```bash
  ngrok http 3000
  # or
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  ```
- Update your Stripe dashboard/webhook settings to use the public URL.
- For Stripe Connect onboarding, always use your production URL for `business_profile.url` (see Stripe docs).

## Supabase
- The app uses Supabase for authentication and database. You can use the hosted project or run Supabase locally with the CLI.
- See `docs/database/database-schema.txt` for schema reference.

## Troubleshooting
- **403 errors:** Check Supabase Row Level Security (see `docs/database/rowlevelsecurity.txt`).
- **Stripe onboarding issues:** Ensure you are not using `localhost` or ngrok URLs for `business_profile.url`.
- **Database errors:** Check schema and constraints in `docs/database/database-schema.txt` and `constraints.txt`.

## Useful Links
- [README.md](../README.md)
- [Database Schema](./database/database-schema.txt)
- [RLS Policies](./database/rowlevelsecurity.txt) 