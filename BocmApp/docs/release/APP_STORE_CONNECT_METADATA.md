# App Store Connect – Metadata + Review Notes (iOS)

This document is written to match the **actual mobile app behavior** in `BocmApp/`:
- Marketplace for **real-world beauty services** (booking + Stripe payments)
- Location-based discovery (foreground location)
- UGC (profiles, reviews, portfolio photos, short videos “cuts” feed)
- Push notifications (booking/payment/updates)
- Supabase backend + Stripe + Sentry

Use this as your “paste-ready” source for App Store Connect.

---

## App Information (App Store Connect)

### App Name
**BOCM**

### Subtitle (≤ 30 chars)
Pick one:
- **Book Beauty Pros Nearby**
- **Discover & Book Beauty Pros**
- **Beauty Services, Booked Fast**

### Promotional Text (≤ 170 chars) *(Optional but recommended)*
Find nearby beauty professionals, explore portfolios, and book appointments in minutes. Secure payments, real-time availability, and reminders built in.

### Keywords (≤ 100 chars total)
Copy/paste (keep commas, Apple ignores spaces):
beauty,cosmetologist,esthetician,makeup,hair,nails,barber,booking,appointment,freelance

### Category
Recommended:
- **Primary**: Lifestyle
- **Secondary**: Health & Fitness *(or Shopping, depending on positioning)*

### Age Rating
Recommended default for this app’s feature set (UGC + profiles + reviews + video): **17+**
- You may be able to lower this to **12+** if you can demonstrate robust, active moderation for UGC (and you’re confident in your enforcement workflow).

---

## App Store Description (≤ 4,000 chars)

BOCM is a marketplace built for at-home and freelance beauty professionals—and the clients looking to book them. Discover nearby professionals, explore their work, check availability, and book securely in one place.

### For Clients
- Find professionals near you with location-based discovery
- Browse professional profiles, specialties, and reviews
- Explore portfolios (photos and short videos)
- Book appointments with real-time availability
- Pay securely (powered by Stripe)
- Get reminders and updates for upcoming appointments

### For Beauty Professionals
- Create a professional profile and showcase your work
- Upload portfolio photos and videos to get discovered
- Manage bookings and your schedule
- Share your booking link to grow your business
- Receive payments securely through Stripe

BOCM supports user reporting and blocking features to help keep the community safe.

Note: Availability and features may vary by location and by professional.

---

## What to Avoid in the Public App Store Listing

To reduce review risk:
- Avoid calling the App Store release “beta” (use **TestFlight** for beta language).
- Avoid unverifiable claims like “the first platform” unless you can substantiate it.
- Avoid implying medical outcomes (for skincare/beauty).

If you *are* submitting for TestFlight only, you can use “beta” language in **Test Information** instead.

---

## App Review Information (Notes for Apple Review)

Paste something like this into **Review Notes**:

**BOCM is a marketplace for real-world beauty services (appointments). Payments are for in-person services and are processed via Stripe (no digital goods or subscriptions).**

**Key flows to test:**
1) Sign up as Client → browse professionals → book appointment → pay via Stripe test mode
2) Sign up as Professional → complete profile → connect Stripe → add availability → receive booking notifications

**Permissions rationale:**
- Location (When In Use): to show nearby professionals and improve search results
- Camera/Photos: to upload profile photos and portfolio content (including recording short videos)
- Microphone: to record audio while recording portfolio videos
- Notifications: booking/payment confirmations, reminders, and updates

**UGC moderation / safety:**
Users can report content and block other users. Reported content is reviewed and actioned according to our policies.

### Test credentials
Apple will likely need a working test account (or you can create one during review). Provide either:
- A dedicated “review” client account email/password, and optionally a “review” professional account; **or**
- Instructions to create accounts in-app without phone/SMS gates.

*(If you want, tell me what your current auth requirements are—email/password only vs SMS/OTP—so I can tailor this section exactly.)*

---

## App Privacy (Data Collection / Sharing) – Suggested Mapping

You’ll answer this in App Store Connect → **App Privacy**. Based on the code and policies in `BocmApp/`:

### Data collected
Likely collected:
- **Contact Info**: name, email, phone (account + booking communication)
- **Identifiers**: user ID, device identifiers (for auth/session + debugging)
- **Location**: precise location when permission granted (nearby discovery)
- **User Content**: photos/videos uploaded, profile text, reviews
- **Diagnostics**: crash logs, performance data (Sentry)

### Data shared with third parties
Likely “shared” (depending on Apple’s definitions and your Sentry/Stripe configuration):
- **Payment**: Stripe receives payment-related info to process transactions
- **Diagnostics**: Sentry receives error/diagnostic events

### Tracking
If you are **not** using IDFA/ad attribution, and not sharing user data across apps/sites for advertising, you likely should answer:
- **Tracking: No**

Important: Apple’s privacy answers must match your actual SDK configuration and behavior. If you want, I can audit `app/shared/lib/sentry.ts` and any analytics code to confirm the safest answers.

---

## URLs Required by App Store Connect

You’ll need these URLs even if you also show them in-app:
- **Support URL**: your support page/email landing page
- **Privacy Policy URL**: a public web URL to your privacy policy

If you don’t have these on the website yet, we can add Next.js routes (e.g. `/privacy` and `/support`) in the root web app and deploy them (Vercel).


