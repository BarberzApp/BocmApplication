import { supabase } from './supabase';
import { GoogleCalendarAPI, CalendarSyncService } from './google-calendar-api';
import { logger } from './logger';

interface SyncJob {
  id: string;
  user_id: string;
  connection_id: string;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  results?: any;
}

export class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  // Start background sync service
  async start(intervalMinutes: number = 15) {
    if (this.isRunning) {
      logger.debug('Background sync service is already running');
      return;
    }

    logger.debug(`Starting background sync service with ${intervalMinutes} minute interval`);
    this.isRunning = true;

    // Run initial sync
    await this.runSync();

    // Set up interval
    this.syncInterval = setInterval(async () => {
      await this.runSync();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop background sync service
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    logger.debug('Background sync service stopped');
  }

  // Run sync for all active connections
  private async runSync() {
    try {
      logger.debug('Running background sync...');

      // Get all active calendar connections
      const { data: connections, error } = await supabase
        .from('user_calendar_connections')
        .select('*')
        .eq('sync_enabled', true);

      if (error) {
        logger.error('Error fetching calendar connections', error);
        return;
      }

      if (!connections || connections.length === 0) {
        logger.debug('No active calendar connections found');
        return;
      }

      logger.debug(`Found ${connections.length} active calendar connections`);

      // Process each connection
      for (const connection of connections) {
        try {
          await this.syncConnection(connection);
        } catch (error) {
          logger.error(`Error syncing connection ${connection.id}`, error);
          
          // Log sync error
          await CalendarSyncService.logSyncOperation(
            connection.user_id,
            connection.id,
            'background_sync',
            'failed',
            { connection_id: connection.id },
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      logger.debug('Background sync completed');
    } catch (error) {
      logger.error('Error in background sync', error);
    }
  }

  // Sync a single connection
  private async syncConnection(connection: any) {
    logger.debug(`Syncing connection ${connection.id} for user ${connection.user_id}`);

    // Check if token is expired
    const api = new GoogleCalendarAPI(connection.access_token, connection.refresh_token);
    
    if (api.isTokenExpired(connection.expires_at)) {
      if (!connection.refresh_token) {
        logger.error(`Connection ${connection.id} has expired token and no refresh token`);
        return;
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
        logger.error(`Error refreshing token for connection ${connection.id}`, refreshError);
        return;
      }
    }

    const syncResults = {
      syncedToGoogle: 0,
      syncedFromGoogle: 0,
      errors: [] as string[]
    };

    // Sync based on direction
    if (connection.sync_direction === 'outbound' || connection.sync_direction === 'bidirectional') {
      await this.syncToGoogle(connection, api, syncResults);
    }

    if (connection.sync_direction === 'inbound' || connection.sync_direction === 'bidirectional') {
      await this.syncFromGoogle(connection, api, syncResults);
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
      connection.user_id,
      connection.id,
      'background_sync',
      syncResults.errors.length === 0 ? 'success' : 'partial',
      syncResults
    );

    logger.debug(`Sync completed for connection ${connection.id}`, { syncResults });
  }

  // Sync bookings to Google Calendar
  private async syncToGoogle(connection: any, api: GoogleCalendarAPI, results: any) {
    try {
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          *,
          barbers!inner(*),
          services!inner(*)
        `)
        .eq('user_id', connection.user_id)
        .gte('start_time', new Date().toISOString());

      for (const booking of bookings || []) {
        try {
          // Check if already synced
          const isSynced = await CalendarSyncService.isEventSynced(
            connection.user_id,
            `booking_${booking.id}`,
            connection.calendar_id
          );

          if (!isSynced) {
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
              connection.user_id,
              googleEvent.id!,
              connection.calendar_id,
              booking.id,
              googleEvent,
              'outbound'
            );

            results.syncedToGoogle++;
          }
        } catch (bookingError) {
          logger.error(`Error syncing booking ${booking.id}`, bookingError);
          results.errors.push(`Failed to sync booking ${booking.id}`);
        }
      }
    } catch (error) {
      logger.error('Error syncing bookings to Google', error);
      results.errors.push('Failed to sync bookings to Google Calendar');
    }
  }

  // Sync events from Google Calendar
  private async syncFromGoogle(connection: any, api: GoogleCalendarAPI, results: any) {
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
            connection.user_id,
            event.id!,
            connection.calendar_id
          );

          if (!isSynced) {
            // Save synced event
            await CalendarSyncService.saveSyncedEvent(
              connection.user_id,
              event.id!,
              connection.calendar_id,
              undefined,
              event,
              'inbound'
            );

            results.syncedFromGoogle++;
          }
        } catch (eventError) {
          logger.error(`Error syncing event ${event.id}`, eventError);
          results.errors.push(`Failed to sync event ${event.id}`);
        }
      }
    } catch (error) {
      logger.error('Error syncing events from Google', error);
      results.errors.push('Failed to sync events from Google Calendar');
    }
  }

  // Manual sync for a specific user
  async manualSync(userId: string, direction: 'inbound' | 'outbound' | 'bidirectional' = 'bidirectional') {
    try {
      const connection = await CalendarSyncService.getCalendarConnection(userId);
      
      if (!connection) {
        throw new Error('No calendar connection found');
      }

      if (!connection.sync_enabled) {
        throw new Error('Calendar sync is disabled');
      }

      await this.syncConnection(connection);
      return true;
    } catch (error) {
      logger.error('Error in manual sync', error);
      throw error;
    }
  }

  // Get sync status
  getRunningStatus(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const backgroundSync = BackgroundSyncService.getInstance(); 