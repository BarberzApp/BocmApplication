import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { GoogleCalendarAPI, CalendarSyncService } from '@/shared/lib/google-calendar-api';
import { logger } from '@/shared/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { direction = 'bidirectional', force = false } = await request.json();
    
    // Get current user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user's calendar connection
    const connection = await CalendarSyncService.getCalendarConnection(user.id);
    
    if (!connection) {
      return NextResponse.json(
        { error: 'No Google Calendar connection found' },
        { status: 404 }
      );
    }

    if (!connection.sync_enabled) {
      return NextResponse.json(
        { error: 'Calendar sync is disabled' },
        { status: 400 }
      );
    }

    // Check if token is expired and refresh if needed
    const api = new GoogleCalendarAPI(connection.access_token, connection.refresh_token);
    
    if (api.isTokenExpired(connection.expires_at)) {
      if (!connection.refresh_token) {
        return NextResponse.json(
          { error: 'Access token expired and no refresh token available' },
          { status: 401 }
        );
      }

      try {
        const newTokens = await api.refreshAccessToken(connection.refresh_token);
        
        // Update connection with new tokens
        await supabase
          .from('user_calendar_connections')
          .update({
            access_token: newTokens.access_token,
            expires_at: newTokens.expires_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        // Update connection object
        connection.access_token = newTokens.access_token;
        connection.expires_at = newTokens.expires_at;
      } catch (refreshError) {
        logger.error('Error refreshing token', refreshError);
        return NextResponse.json(
          { error: 'Failed to refresh access token' },
          { status: 401 }
        );
      }
    }

    const syncResults = {
      syncedToGoogle: 0,
      syncedFromGoogle: 0,
      errors: [] as string[]
    };

    // Sync bookings to Google Calendar (outbound)
    if (direction === 'outbound' || direction === 'bidirectional') {
      try {
        const { data: bookings } = await supabase
          .from('bookings')
          .select(`
            *,
            barbers!inner(*),
            services!inner(*)
          `)
          .eq('user_id', user.id)
          .gte('start_time', new Date().toISOString());

        for (const booking of bookings || []) {
          try {
            // Check if already synced
            const isSynced = await CalendarSyncService.isEventSynced(
              user.id,
              `booking_${booking.id}`,
              connection.calendar_id
            );

            if (!isSynced || force) {
              const event = {
                summary: `Haircut with ${booking.barbers.name}`,
                description: `Service: ${booking.services.name}\nNotes: ${booking.notes || 'No notes'}`,
                location: booking.barbers.location || 'Barber Shop',
                start: {
                  dateTime: booking.start_time,
                  timeZone: 'UTC'
                },
                end: {
                  dateTime: booking.end_time,
                  timeZone: 'UTC'
                },
                reminders: {
                  useDefault: false,
                  overrides: [
                    { method: 'popup' as const, minutes: 30 }
                  ]
                }
              };

              const googleEvent = await api.createEvent(connection.calendar_id, event);
              
              // Save synced event
              await CalendarSyncService.saveSyncedEvent(
                user.id,
                googleEvent.id!,
                connection.calendar_id,
                booking.id,
                googleEvent,
                'outbound'
              );

              syncResults.syncedToGoogle++;
            }
          } catch (bookingError) {
            logger.error(`Error syncing booking ${booking.id}`, bookingError);
            syncResults.errors.push(`Failed to sync booking ${booking.id}`);
          }
        }
      } catch (error) {
        logger.error('Error syncing bookings to Google', error);
        syncResults.errors.push('Failed to sync bookings to Google Calendar');
      }
    }

    // Sync events from Google Calendar (inbound)
    if (direction === 'inbound' || direction === 'bidirectional') {
      try {
        // Get events from last 30 days to next 90 days
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 30);
        
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 90);

        const googleEvents = await api.getEvents(connection.calendar_id, timeMin, timeMax);

        for (const event of googleEvents) {
          try {
            // Skip events that are already synced from our app
            if (event.description?.includes('Service:') || event.summary?.includes('Haircut with')) {
              continue;
            }

            // Check if already synced
            const isSynced = await CalendarSyncService.isEventSynced(
              user.id,
              event.id!,
              connection.calendar_id
            );

            if (!isSynced || force) {
              // Save synced event
              await CalendarSyncService.saveSyncedEvent(
                user.id,
                event.id!,
                connection.calendar_id,
                undefined,
                event,
                'inbound'
              );

              syncResults.syncedFromGoogle++;
            }
          } catch (eventError) {
            logger.error(`Error syncing event ${event.id}`, eventError);
            syncResults.errors.push(`Failed to sync event ${event.id}`);
          }
        }
      } catch (error) {
        logger.error('Error syncing events from Google', error);
        syncResults.errors.push('Failed to sync events from Google Calendar');
      }
    }

    // Update last sync time
    await supabase
      .from('user_calendar_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);

    // Log sync operation
    await CalendarSyncService.logSyncOperation(
      user.id,
      connection.id,
      'sync',
      syncResults.errors.length === 0 ? 'success' : 'partial',
      syncResults
    );

    return NextResponse.json({
      success: true,
      message: 'Calendar sync completed',
      results: syncResults
    });

  } catch (error) {
    logger.error('Error in calendar sync', error);
    return NextResponse.json(
      { error: 'Failed to sync calendar' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    logger.debug('Calendar sync GET called');
    
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    logger.debug('Calendar sync - Auth result', { userId: user?.id, hasError: !!userError });
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user's calendar connection
    const connection = await CalendarSyncService.getCalendarConnection(user.id);
    
    if (!connection) {
      return NextResponse.json(
        { error: 'No Google Calendar connection found' },
        { status: 404 }
      );
    }

    // Get recent sync logs
    const { data: syncLogs } = await supabase
      .from('calendar_sync_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('connection_id', connection.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get synced events count
    const { count: syncedEventsCount } = await supabase
      .from('synced_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return NextResponse.json({
      connection: {
        id: connection.id,
        provider: connection.provider,
        sync_enabled: connection.sync_enabled,
        sync_direction: connection.sync_direction,
        last_sync_at: connection.last_sync_at
      },
      stats: {
        syncedEventsCount: syncedEventsCount || 0
      },
      recentLogs: syncLogs || []
    });

  } catch (error) {
    logger.error('Error getting calendar sync status', error);
    return NextResponse.json(
      { error: 'Failed to get calendar sync status' },
      { status: 500 }
    );
  }
} 