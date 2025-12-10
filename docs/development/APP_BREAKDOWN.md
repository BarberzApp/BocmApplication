# App Breakdown

This document provides a high-level overview of the Barber App's architecture, main flows, and where to find important logic in the codebase.

## Architecture Overview
- **Frontend:** Next.js 14 (TypeScript, Tailwind CSS)
- **Backend:** Next.js API routes, Supabase (Postgres, Auth)
- **Payments:** Stripe Connect
- **Database:** See `docs/database/database-schema.txt`

## Main Flows

### 1. Onboarding (Barber)
- **Purpose:** Collect business info, services, and connect Stripe account.
- **Key File:** `src/app/barber/onboarding/page.tsx`
- **DB Tables:** `barbers`, `profiles`, `services`
- **Stripe Connect:** See `/api/connect/create-account` and Stripe dashboard for account status.
- **Logic:**
  - Checks for required fields and Stripe account status before marking onboarding as complete.
  - See RLS policies in `docs/database/rowlevelsecurity.txt` for permissions.

### 2. Booking
- **Purpose:** Clients book appointments with barbers.
- **Key Files:**
  - `src/features/booking/`
  - `src/app/(client)/bookings/`
- **DB Tables:** `bookings`, `services`, `barbers`, `profiles`
- **Logic:**
  - Checks barber availability, service selection, and payment status.

### 3. Payments
- **Purpose:** Handle payments via Stripe, including platform fees and payouts.
- **Key Files:**
  - `src/shared/lib/stripe-service.ts`
  - `src/app/api/webhooks/stripe/`
- **DB Tables:** `payments`, `bookings`, `barbers`
- **Logic:**
  - Stripe webhooks update payment and booking status.
  - See `docs/database/database-schema.txt` for payment fields.

## Where to Find Key Logic
- **Authentication:** `src/features/auth/`
- **Profile Management:** `src/features/profile/`, `src/app/(client)/profile/`, `src/app/(barber)/profile/`
- **Stripe Connect:** `src/app/api/connect/`, `src/shared/lib/stripe-service.ts`
- **RLS Policies:** `docs/database/rowlevelsecurity.txt`

## Additional References
- [README.md](../README.md)
- [Database Schema](./database/database-schema.txt)
- [Local Development Guide](./LOCAL_DEVELOPMENT.md) 