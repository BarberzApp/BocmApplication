import { google } from 'googleapis';
import { supabase } from './supabase';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  colorId?: string;
  transparency?: 'opaque' | 'transparent';
}

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  calendar_id: string;
  sync_enabled: boolean;
  last_sync_at?: string;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  created_at?: string;
  updated_at?: string;
}

export class GoogleCalendarAPI {
  private oauth2Client: any;

  constructor(accessToken: string, refreshToken?: string) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }

  // Get all events from Google Calendar
  async getEvents(calendarId: string = 'primary', timeMin?: Date, timeMax?: Date, maxResults: number = 2500) {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin?.toISOString(),
        timeMax: timeMax?.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items || [];
    } catch (error) {
      logger.error('Error fetching Google Calendar events', error);
      throw error;
    }
  }

  // Create event in Google Calendar
  async createEvent(calendarId: string, event: GoogleCalendarEvent) {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.events.insert({
        calendarId,
        requestBody: event
      });

      return response.data;
    } catch (error) {
      logger.error('Error creating Google Calendar event', error);
      throw error;
    }
  }

  // Update event in Google Calendar
  async updateEvent(calendarId: string, eventId: string, event: GoogleCalendarEvent) {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: event
      });

      return response.data;
    } catch (error) {
      logger.error('Error updating Google Calendar event', error);
      throw error;
    }
  }

  // Delete event from Google Calendar
  async deleteEvent(calendarId: string, eventId: string) {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      await calendar.events.delete({
        calendarId,
        eventId
      });

      return true;
    } catch (error) {
      logger.error('Error deleting Google Calendar event', error);
      throw error;
    }
  }

  // Get calendar list
  async getCalendarList() {
    try {
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.calendarList.list();
      
      return response.data.items || [];
    } catch (error) {
      logger.error('Error fetching calendar list', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      return {
        access_token: credentials.access_token,
        expires_at: new Date(credentials.expiry_date).toISOString()
      };
    } catch (error) {
      logger.error('Error refreshing access token', error);
      throw error;
    }
  }

  // Check if token is expired
  isTokenExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date();
  }
}

// Utility functions for calendar operations
export class CalendarSyncService {
  // Get user's calendar connection
  static async getCalendarConnection(userId: string, provider: string = 'google_calendar') {
    const { data, error } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error) {
      logger.error('Error fetching calendar connection', error);
      return null;
    }

    return data as CalendarConnection;
  }

  // Save calendar connection
  static async saveCalendarConnection(connection: Partial<CalendarConnection>) {
    const { data, error } = await supabase
      .from('user_calendar_connections')
      .upsert(connection, { onConflict: 'user_id,provider' })
      .select()
      .single();

    if (error) {
      logger.error('Error saving calendar connection', error);
      throw error;
    }

    return data;
  }

  // Log sync operation
  static async logSyncOperation(
    userId: string,
    connectionId: string,
    operation: string,
    status: string,
    details?: any,
    errorMessage?: string
  ) {
    const { error } = await supabase
      .from('calendar_sync_logs')
      .insert({
        user_id: userId,
        connection_id: connectionId,
        operation,
        status,
        details,
        error_message: errorMessage
      });

    if (error) {
      logger.error('Error logging sync operation', error);
    }
  }

  // Save synced event
  static async saveSyncedEvent(
    userId: string,
    externalEventId: string,
    externalCalendarId: string,
    bookingId?: string,
    eventData?: any,
    syncDirection: string = 'bidirectional'
  ) {
    const { data, error } = await supabase
      .from('synced_events')
      .upsert({
        user_id: userId,
        external_event_id: externalEventId,
        external_calendar_id: externalCalendarId,
        booking_id: bookingId,
        event_data: eventData,
        sync_direction: syncDirection,
        last_synced_at: new Date().toISOString()
      }, { onConflict: 'user_id,external_event_id,external_calendar_id' })
      .select()
      .single();

    if (error) {
      logger.error('Error saving synced event', error);
      throw error;
    }

    return data;
  }

  // Get synced events for user
  static async getSyncedEvents(userId: string) {
    const { data, error } = await supabase
      .from('synced_events')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      logger.error('Error fetching synced events', error);
      return [];
    }

    return data;
  }

  // Check if event is already synced
  static async isEventSynced(userId: string, externalEventId: string, externalCalendarId: string) {
    const { data, error } = await supabase
      .from('synced_events')
      .select('id')
      .eq('user_id', userId)
      .eq('external_event_id', externalEventId)
      .eq('external_calendar_id', externalCalendarId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error checking if event is synced', error);
      return false;
    }

    return !!data;
  }

  // Update sync status
  static async updateSyncStatus(
    userId: string,
    externalEventId: string,
    externalCalendarId: string,
    status: string
  ) {
    const { error } = await supabase
      .from('synced_events')
      .update({
        sync_status: status,
        last_synced_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('external_event_id', externalEventId)
      .eq('external_calendar_id', externalCalendarId);

    if (error) {
      logger.error('Error updating sync status', error);
      throw error;
    }
  }
} 