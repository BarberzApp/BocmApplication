import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth-zustand';
import { supabase } from '@/shared/lib/supabase';
import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';

interface CalendarConnection {
  id: string;
  provider: string;
  sync_enabled: boolean;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  last_sync_at?: string;
  created_at?: string;
}

interface SyncStatus {
  connection: CalendarConnection | null;
  connected: boolean;
  loading: boolean;
  syncing: boolean;
  stats: {
    syncedEventsCount: number;
  };
  recentLogs: any[];
}

interface SyncResults {
  syncedToGoogle: number;
  syncedFromGoogle: number;
  errors: string[];
}

export const useCalendarSync = () => {
  const { user, status: authStatus } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({
    connection: null,
    connected: false,
    loading: authStatus === 'loading',
    syncing: false,
    stats: {
      syncedEventsCount: 0
    },
    recentLogs: []
  });

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    if (!user) {
      logger.debug('Calendar sync: No user, skipping fetch');
      setStatus(prev => ({ ...prev, loading: false, connected: false }));
      return;
    }

    // Prevent multiple simultaneous calls
    if (status.loading) {
      logger.debug('Calendar sync: Already loading, skipping fetch');
      return;
    }

    try {
      logger.debug('Calendar sync: Fetching status for user', { userId: user.id });
      setStatus(prev => ({ ...prev, loading: true }));

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        logger.error('Calendar sync: No access token available');
        setStatus(prev => ({ ...prev, loading: false, connected: false }));
        return;
      }

      const response = await fetch('/api/calendar/sync', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      logger.debug('Calendar sync: Response status', { status: response.status });
      
      if (!response.ok) {
        if (response.status === 404) {
          // No connection found
          logger.debug('Calendar sync: No connection found (404)');
          setStatus(prev => ({
            ...prev,
            loading: false,
            connected: false,
            connection: null
          }));
          return;
        }
        
        if (response.status === 401) {
          logger.error('Calendar sync: Authentication error (401)');
          setStatus(prev => ({ ...prev, loading: false, connected: false }));
          toast.error('Authentication required. Please log in again.');
          return;
        }
        
        const errorText = await response.text();
        logger.error('Calendar sync: API error', { status: response.status, errorText });
        throw new Error(`Failed to fetch calendar status: ${response.status}`);
      }

      const data = await response.json();
      logger.debug('Calendar sync: Success', { data });
      
      setStatus(prev => ({
        ...prev,
        loading: false,
        connected: true,
        connection: data.connection,
        stats: data.stats,
        recentLogs: data.recentLogs
      }));

    } catch (error) {
      logger.error('Error fetching calendar status', error);
      setStatus(prev => ({ ...prev, loading: false }));
      toast.error('Failed to load calendar status');
    }
  }, [user]);

  // Only fetch status when user is authenticated
  useEffect(() => {
    if (authStatus === 'authenticated' && user) {
      logger.debug('Calendar sync: User authenticated, fetching status');
      fetchStatus();
    } else if (authStatus === 'unauthenticated') {
      logger.debug('Calendar sync: User not authenticated, clearing status');
      setStatus(prev => ({ 
        ...prev, 
        loading: false, 
        connected: false, 
        connection: null 
      }));
    }
  }, [authStatus, user, fetchStatus]);

  // Connect to Google Calendar
  const connect = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to connect your calendar');
      return;
    }

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        logger.error('Calendar connect: No access token available');
        toast.error('Authentication required. Please log in again.');
        return;
      }

      // Get auth URL with proper authentication
      const response = await fetch('/api/auth/google-calendar', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication required. Please log in again.');
          return;
        }
        throw new Error('Failed to get authentication URL');
      }

      const { url } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = url;

    } catch (error) {
      logger.error('Error connecting to Google Calendar', error);
      toast.error('Failed to connect to Google Calendar');
    }
  }, [user]);

  // Disconnect from Google Calendar
  const disconnect = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to disconnect your calendar');
      return;
    }

    try {
      setStatus(prev => ({ ...prev, loading: true }));

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        logger.error('Calendar disconnect: No access token available');
        toast.error('Authentication required. Please log in again.');
        setStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      const response = await fetch('/api/calendar/connection', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication required. Please log in again.');
          setStatus(prev => ({ ...prev, loading: false }));
          return;
        }
        throw new Error('Failed to disconnect calendar');
      }

      setStatus(prev => ({
        ...prev,
        loading: false,
        connected: false,
        connection: null,
        stats: { syncedEventsCount: 0 },
        recentLogs: []
      }));

      toast.success('Calendar disconnected successfully');

    } catch (error) {
      logger.error('Error disconnecting calendar', error);
      setStatus(prev => ({ ...prev, loading: false }));
      toast.error('Failed to disconnect calendar');
    }
  }, [user]);

  // Sync calendar
  const sync = useCallback(async (direction: 'inbound' | 'outbound' | 'bidirectional' = 'bidirectional', force: boolean = false): Promise<SyncResults | null> => {
    if (!user || !status.connected) {
      toast.error('Please connect your calendar first');
      return null;
    }

    try {
      setStatus(prev => ({ ...prev, syncing: true }));

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        logger.error('Calendar sync: No access token available');
        toast.error('Authentication required. Please log in again.');
        setStatus(prev => ({ ...prev, syncing: false }));
        return null;
      }

      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ direction, force })
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication required. Please log in again.');
          setStatus(prev => ({ ...prev, syncing: false }));
          return null;
        }
        throw new Error('Failed to sync calendar');
      }

      const data = await response.json();
      
      // Refresh status after sync
      await fetchStatus();

      const results = data.results as SyncResults;
      
      if (results.errors.length > 0) {
        toast.warning(`Sync completed with ${results.errors.length} errors`);
      } else {
        toast.success(`Sync completed successfully! Synced ${results.syncedToGoogle} to Google, ${results.syncedFromGoogle} from Google`);
      }

      return results;

    } catch (error) {
      logger.error('Error syncing calendar', error);
      toast.error('Failed to sync calendar');
      return null;
    } finally {
      setStatus(prev => ({ ...prev, syncing: false }));
    }
  }, [user, status.connected, fetchStatus]);

  // Update connection settings
  const updateSettings = useCallback(async (settings: { sync_enabled?: boolean; sync_direction?: 'inbound' | 'outbound' | 'bidirectional' }) => {
    if (!user || !status.connected) {
      toast.error('Please connect your calendar first');
      return;
    }

    try {
      setStatus(prev => ({ ...prev, loading: true }));

      const response = await fetch('/api/calendar/connection', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Failed to update calendar settings');
      }

      const data = await response.json();
      
      setStatus(prev => ({
        ...prev,
        loading: false,
        connection: data.connection
      }));

      toast.success('Calendar settings updated successfully');

    } catch (error) {
      logger.error('Error updating calendar settings', error);
      setStatus(prev => ({ ...prev, loading: false }));
      toast.error('Failed to update calendar settings');
    }
  }, [user, status.connected]);

  // Check for OAuth callback success/error
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'calendar_connected') {
      toast.success('Google Calendar connected successfully!');
      fetchStatus();
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('success');
      window.history.replaceState({}, '', newUrl.toString());
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        'oauth_failed': 'Failed to authenticate with Google Calendar',
        'no_code': 'Authentication was cancelled',
        'no_token': 'Failed to get access token',
        'save_failed': 'Failed to save calendar connection',
        'callback_failed': 'Authentication callback failed',
        'access_denied': 'Access denied - please check your Google Calendar permissions',
        'not_authenticated': 'Please log in to connect Google Calendar',
        'database_error': 'Database error - please try again'
      };

      const message = urlParams.get('message') || errorMessages[error] || 'Authentication failed';
      toast.error(message);
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      newUrl.searchParams.delete('message');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [fetchStatus]);



  return {
    ...status,
    connect,
    disconnect,
    sync,
    updateSettings,
    refresh: fetchStatus
  };
}; 