# Google Calendar Sync Implementation

This document outlines the complete implementation of Google Calendar sync functionality for the barber app, enabling bidirectional synchronization between the app's booking system and Google Calendar.

## Overview

The Google Calendar sync feature allows users to:
- Connect their Google Calendar account via OAuth 2.0
- Automatically sync appointments in both directions
- Configure sync settings (bidirectional, outbound-only, inbound-only)
- View sync status and history
- Manually trigger sync operations

## Architecture

### Database Schema

The implementation uses three new tables:

1. **`user_calendar_connections`** - Stores OAuth connections
2. **`synced_events`** - Tracks synced events between systems
3. **`calendar_sync_logs`** - Logs sync operations for debugging

### Key Components

1. **Google Calendar API Service** (`src/shared/lib/google-calendar-api.ts`)
2. **OAuth Authentication Routes** (`src/app/api/auth/google-calendar/`)
3. **Sync API Routes** (`src/app/api/calendar/sync/`)
4. **Connection Management API** (`src/app/api/calendar/connection/`)
5. **React Hook** (`src/shared/hooks/useCalendarSync.ts`)
6. **UI Component** (`src/shared/components/calendar-sync-settings.tsx`)
7. **Background Sync Service** (`src/shared/lib/background-sync.ts`)

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/google-calendar/callback` (development)
     - `https://yourdomain.com/api/auth/google-calendar/callback` (production)

### 2. Environment Variables

Add these to your `.env.local`:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google-calendar/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Migration

Run the migration to create the required tables:

```bash
supabase db push
```

## API Endpoints

### OAuth Authentication

- `GET /api/auth/google-calendar` - Get OAuth URL
- `POST /api/auth/google-calendar` - Exchange code for tokens
- `GET /api/auth/google-calendar/callback` - OAuth callback handler

### Calendar Sync

- `GET /api/calendar/sync` - Get sync status
- `POST /api/calendar/sync` - Trigger manual sync

### Connection Management

- `GET /api/calendar/connection` - Get connection status
- `PATCH /api/calendar/connection` - Update connection settings
- `DELETE /api/calendar/connection` - Disconnect calendar

## Usage

### Connecting Google Calendar

1. Navigate to Settings > Calendar tab
2. Click "Connect Google Calendar"
3. Complete OAuth flow in Google
4. Configure sync settings

### Sync Configuration

Users can configure:
- **Sync Direction**: Bidirectional, Outbound-only, Inbound-only
- **Sync Enabled**: Toggle automatic syncing
- **Manual Sync**: Trigger immediate sync operations

### Sync Behavior

#### Outbound Sync (App → Google)
- Creates Google Calendar events for new bookings
- Includes service details, barber name, and location
- Sets 30-minute reminder notifications

#### Inbound Sync (Google → App)
- Imports Google Calendar events (excluding app-generated events)
- Stores events in `synced_events` table for reference
- Skips events with "Service:" or "Haircut with" in description

## Background Sync

The background sync service automatically syncs calendars at regular intervals:

```typescript
import { backgroundSync } from '@/shared/lib/background-sync';

// Start background sync (runs every 15 minutes)
await backgroundSync.start(15);

// Stop background sync
backgroundSync.stop();
```

## Error Handling

The implementation includes comprehensive error handling:

1. **Token Refresh**: Automatically refreshes expired access tokens
2. **Retry Logic**: Implements retry mechanisms for failed operations
3. **Error Logging**: Logs all sync operations and errors
4. **User Feedback**: Provides clear error messages and status updates

## Security Considerations

1. **OAuth 2.0**: Secure authentication flow with refresh tokens
2. **Row Level Security**: Database tables protected with RLS policies
3. **Token Storage**: Access tokens encrypted in database
4. **Scope Limitation**: Minimal required permissions (calendar read/write)

## Monitoring and Debugging

### Sync Logs

All sync operations are logged in the `calendar_sync_logs` table with:
- Operation type (connect, sync, background_sync)
- Status (success, failed, partial)
- Error messages and details
- Timestamps

### Status Monitoring

The UI displays:
- Connection status
- Last sync time
- Sync statistics
- Recent sync logs

## Troubleshooting

### Common Issues

1. **"Failed to get access token"**
   - Check Google Cloud Console credentials
   - Verify redirect URI configuration

2. **"Access token expired"**
   - Refresh tokens should handle this automatically
   - Check if refresh token is stored correctly

3. **"No calendar connection found"**
   - User needs to complete OAuth flow
   - Check database for connection record

4. **Sync not working**
   - Verify sync is enabled in settings
   - Check sync direction configuration
   - Review sync logs for errors

### Debug Commands

```typescript
// Check connection status
const connection = await CalendarSyncService.getCalendarConnection(userId);

// View sync logs
const logs = await supabase
  .from('calendar_sync_logs')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Manual sync
await backgroundSync.manualSync(userId, 'bidirectional');
```

## Future Enhancements

1. **Multiple Calendar Support**: Allow users to sync with multiple calendars
2. **Conflict Resolution**: Handle conflicting events between systems
3. **Webhook Integration**: Real-time sync via Google Calendar webhooks
4. **Calendar Selection**: Let users choose which calendar to sync with
5. **Advanced Filtering**: Filter events by type, date range, etc.
6. **Bulk Operations**: Support for bulk sync operations
7. **Analytics**: Sync performance metrics and usage statistics

## Performance Considerations

1. **Rate Limiting**: Respect Google Calendar API rate limits
2. **Batch Operations**: Process multiple events efficiently
3. **Incremental Sync**: Only sync changed events
4. **Background Processing**: Use background jobs for heavy operations
5. **Caching**: Cache frequently accessed data

## Testing

### Manual Testing

1. Connect Google Calendar account
2. Create a booking in the app
3. Verify event appears in Google Calendar
4. Create event in Google Calendar
5. Verify event is synced to app
6. Test sync direction changes
7. Test disconnect functionality

### Automated Testing

```typescript
// Test connection creation
const connection = await CalendarSyncService.saveCalendarConnection({
  user_id: 'test-user',
  provider: 'google_calendar',
  access_token: 'test-token',
  sync_enabled: true
});

// Test sync operation
const results = await backgroundSync.manualSync('test-user');
```

## Deployment Checklist

- [ ] Google Cloud Console credentials configured
- [ ] Environment variables set
- [ ] Database migration applied
- [ ] OAuth redirect URIs updated for production
- [ ] Background sync service configured
- [ ] Error monitoring set up
- [ ] User documentation updated
- [ ] Testing completed

## Support

For issues or questions about the Google Calendar sync implementation:

1. Check the sync logs in the database
2. Review the troubleshooting section
3. Verify Google Cloud Console configuration
4. Test with a fresh OAuth connection
5. Check browser console for client-side errors 