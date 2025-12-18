/**
 * Tests for useCalendarSync hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useCalendarSync } from '../useCalendarSync';
import { useAuth } from '../use-auth-zustand';

// Mock dependencies
jest.mock('../use-auth-zustand');
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('useCalendarSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should initialize with disconnected state when no user', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      status: 'unauthenticated',
    });

    const { result } = renderHook(() => useCalendarSync());

    expect(result.current.connected).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.connection).toBe(null);
  });

  it('should fetch connection status when user is authenticated', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockSession = {
      access_token: 'mock-token',
      user: mockUser,
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      status: 'authenticated',
    });

    const { supabase } = require('@/shared/lib/supabase');
    supabase.auth.getSession = jest.fn().mockResolvedValue({
      data: { session: mockSession },
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        connected: true,
        connection: {
          id: 'conn-123',
          provider: 'google_calendar',
          sync_enabled: true,
          sync_direction: 'bidirectional',
        },
        stats: {
          syncedEventsCount: 5,
        },
        recentLogs: [],
      }),
    });

    const { result } = renderHook(() => useCalendarSync());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/calendar/sync',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    );
  });

  it('should handle connection failure gracefully', async () => {
    const mockUser = { id: 'user-123' };
    const mockSession = {
      access_token: 'mock-token',
      user: mockUser,
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      status: 'authenticated',
    });

    const { supabase } = require('@/shared/lib/supabase');
    supabase.auth.getSession = jest.fn().mockResolvedValue({
      data: { session: mockSession },
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    const { result } = renderHook(() => useCalendarSync());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connected).toBe(false);
  });

  it('should provide connect function', () => {
    const mockUser = { id: 'user-123' };
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      status: 'authenticated',
    });

    const { result } = renderHook(() => useCalendarSync());

    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.sync).toBe('function');
    expect(typeof result.current.updateSettings).toBe('function');
  });
});

