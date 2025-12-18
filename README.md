# Barber App

A modern booking platform connecting barbers with clients.

## Core Features (MVP)

### Authentication
- Client and barber account creation
- Secure login system
- Profile management

### Booking System
- Clean, intuitive calendar interface
- Real-time availability checking
- Instant booking confirmation
- Appointment management

### Payment Processing
- Secure Stripe integration
- Instant payment processing
- Receipt generation
- Payment history

## Technical Stack
- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase
- Stripe

## Project Structure
```
src/
├── features/
│   ├── auth/
│   ├── booking/
│   ├── profile/
│   └── payment/
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── types/
└── app/
    ├── (auth)/
    ├── (client)/
    ├── (barber)/
    └── api/
```

## Documentation

- [App Breakdown](docs/APP_BREAKDOWN.md): High-level overview of the app's architecture, main flows (onboarding, booking, payments), and where to find key logic.
- [Local Development Guide](docs/LOCAL_DEVELOPMENT.md): Step-by-step instructions for running the app locally, Stripe Connect/ngrok setup, troubleshooting, and useful links.
- [Database Schema](docs/database/database-schema.txt): Full schema reference for all tables and relationships.
- [Row Level Security Policies](docs/database/rowlevelsecurity.txt): Supabase RLS policies for all tables.
- [Constraints](docs/database/constraints.txt): Database constraints and keys.

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   
   # Stripe
   STRIPE_SECRET_KEY=your_stripe_secret
   STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   
   # App Configuration
   NEXT_PUBLIC_APP_URL=https://bocmstyle.com
   
   # Sentry Error Monitoring (Optional but recommended for production)
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
   SENTRY_DSN=your_sentry_dsn  # Server-side (optional, can use NEXT_PUBLIC_SENTRY_DSN)
   SENTRY_ORG=your_sentry_org  # For source maps upload
   SENTRY_PROJECT=your_sentry_project  # For source maps upload
   SENTRY_AUTH_TOKEN=your_sentry_auth_token  # For source maps upload (optional)
   
   # Security
   WAITLIST_PASSWORD=your_waitlist_password
   SUPER_ADMIN_PASSWORD=your_super_admin_password
   SUPER_ADMIN_EMAIL=primbocm@gmail.com
   
   # Email/SMS
   GMAIL_USER=your_gmail_user
   GMAIL_PASS=your_gmail_app_password
   ```
4. Run development server:
   ```bash
   npm run dev -- -p 3002
   ```

## Development

### Code Organization
- Feature-based architecture
- Clear separation of concerns
- Modular components
- Type-safe development

### Best Practices
- Follow TypeScript best practices
- Use proper error handling
- Write clean, maintainable code
- Document complex logic

### Testing (adding soon)
- Unit tests for components
- Integration tests for features
- End-to-end testing
- Performance testing

## Super Admin Panel

The app includes a super admin panel for managing developer accounts. Only the specified super admin can access this panel.

### Accessing the Super Admin Panel

1. Navigate to `/super-admin` in your browser
2. Login with the super admin credentials:
   - **Email:** primbocm@gmail.com
   - **Password:** Yasaddybocm123!

### Features

- **View All Barbers:** See a list of all registered barbers with their details
- **Search Barbers:** Search by name, business name, or email
- **Toggle Developer Status:** Enable/disable developer mode for any barber
- **Statistics:** View total barbers, developers, and regular barbers count

### Developer Mode

When a barber has developer mode enabled:
- They bypass all Stripe platform fees ($3.38)
- They receive 100% of the service price
- This is intended for development and testing purposes only

### Setting Up Super Admin

To create the super admin account, run:

```bash
node scripts/create-super-admin.js
```

This script will:
- Create the super admin user account if it doesn't exist
- Set the correct password
- Create the necessary profile record

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License
MIT License - see LICENSE file for details

## 📣 Prominent Booking Link for Barbers

Barbers now see a highly visible, easy-to-share booking link banner at the top of their dashboard and settings. This link is the main way for clients to book appointments. Barbers are encouraged to copy, share, or download a QR code for their booking link and send it to clients via text, social media, or in person.

**How it works:**
- The booking link is always visible at the top of the dashboard and settings.
- Barbers can copy the link, share it using their device's share menu, or download a QR code for print or digital sharing.
- This feature is designed to maximize bookings and make it easy for barbers to grow their business.

**Why this matters:**
- The booking link is the main entry point for new clients.
- Making it prominent ensures every barber knows to share it as much as possible.
- More shared links = more bookings! 
