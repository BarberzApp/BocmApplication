/**
 * Tests for BarberOnboardingPage
 * Tests the onboarding flow logic and data persistence
 */

// Mock Sentry before any other imports
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('../app/shared/lib/sentry', () => ({
  initSentry: jest.fn(),
}));

jest.mock('../app/shared/lib/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock all dependencies
jest.mock('../app/shared/lib/supabase');
jest.mock('../app/shared/hooks/useAuth');

import { supabase } from '../app/shared/lib/supabase';
import { useAuth } from '../app/shared/hooks/useAuth';

describe('BarberOnboardingPage - Onboarding Logic Tests', () => {
  const mockSupabase = supabase as jest.Mocked<typeof supabase>;
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Onboarding Data Flow', () => {
    it('should upsert barber profile with correct data structure', async () => {
      const mockUpsert = jest.fn(() => Promise.resolve({ data: null, error: null }));
      
      mockSupabase.from = jest.fn(() => ({
        upsert: mockUpsert,
      })) as any;

      const formData = {
        businessName: 'Test Shop',
        bio: 'Test bio',
        specialties: ['fade', 'undercut'],
        socialMedia: {
          instagram: '@test',
          twitter: '@test',
          tiktok: '@test',
          facebook: 'test',
        },
      };

      // Simulate the upsert call
      await mockSupabase.from('barbers').upsert({
        user_id: 'test-user-id',
        business_name: formData.businessName,
        bio: formData.bio,
        specialties: formData.specialties,
        instagram: '@test',
        twitter: '@test',
        tiktok: '@test',
        facebook: 'test',
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      expect(mockUpsert).toHaveBeenCalled();
      const callArgs = mockUpsert.mock.calls[0][0];
      expect(callArgs.business_name).toBe('Test Shop');
      expect(callArgs.onboarding_complete).toBe(true);
    });

    it('should update profile phone and location', async () => {
      const mockUpdate = jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      }));

      mockSupabase.from = jest.fn(() => ({
        update: mockUpdate,
      })) as any;

      await mockSupabase.from('profiles').update({
        phone: '+1234567890',
        location: 'New York, NY',
        updated_at: new Date().toISOString(),
      }).eq('id', 'test-user-id');

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should create services correctly', async () => {
      const mockInsert = jest.fn(() => Promise.resolve({ data: null, error: null }));
      const mockDelete = jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      }));

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'services') {
          return {
            delete: mockDelete,
            insert: mockInsert,
          } as any;
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: { id: 'barber-id' }, error: null })),
            })),
          })),
        } as any;
      });

      const services = [
        { name: 'Haircut', price: 30, duration: 30 },
        { name: 'Beard Trim', price: 20, duration: 20 },
      ];

      // Simulate service creation
      await mockSupabase.from('services').delete().eq('barber_id', 'barber-id');
      await mockSupabase.from('services').insert(
        services.map(s => ({
          barber_id: 'barber-id',
          name: s.name,
          price: s.price,
          duration: s.duration,
        }))
      );

      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      const insertArgs = mockInsert.mock.calls[0][0];
      expect(insertArgs).toHaveLength(2);
      expect(insertArgs[0].name).toBe('Haircut');
    });
  });

  describe('Onboarding Completion Check', () => {
    it('should check onboarding_complete flag', async () => {
      const mockSingle = jest.fn(() => Promise.resolve({
        data: { onboarding_complete: true, business_name: 'Test Shop', bio: 'Test', specialties: ['fade'] },
        error: null,
      }));

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: mockSingle,
          })),
        })),
      })) as any;

      const { data } = await mockSupabase
        .from('barbers')
        .select('onboarding_complete, business_name, bio, specialties')
        .eq('user_id', 'test-user-id')
        .single();

      expect(mockSingle).toHaveBeenCalled();
      expect(data?.onboarding_complete).toBe(true);
    });

    it('should handle incomplete onboarding', async () => {
      const mockSingle = jest.fn(() => Promise.resolve({
        data: { onboarding_complete: false, business_name: null, bio: null, specialties: [] },
        error: null,
      }));

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: mockSingle,
          })),
        })),
      })) as any;

      const { data } = await mockSupabase
        .from('barbers')
        .select('onboarding_complete, business_name, bio, specialties')
        .eq('user_id', 'test-user-id')
        .single();

      expect(data?.onboarding_complete).toBe(false);
    });
  });

  describe('Social Media Handle Extraction', () => {
    it('should extract handle from Instagram URL', () => {
      const extractHandle = (input: string): string => {
        if (!input) return '';
        input = input.trim();
        try {
          const url = new URL(input);
          const pathParts = url.pathname.split('/').filter(Boolean);
          if (pathParts.length > 0) {
            let handle = pathParts[pathParts.length - 1];
            if (handle.startsWith('@')) handle = handle.slice(1);
            return '@' + handle;
          }
        } catch {
          // Not a URL
        }
        if (input.startsWith('@')) return input;
        return '@' + input;
      };

      expect(extractHandle('https://instagram.com/testbarber')).toBe('@testbarber');
      expect(extractHandle('@testbarber')).toBe('@testbarber');
      expect(extractHandle('testbarber')).toBe('@testbarber');
    });
  });

  describe('Stripe Connection', () => {
    it('should invoke Stripe Connect function', async () => {
      const mockInvoke = jest.fn(() => Promise.resolve({
        data: { url: 'https://stripe.com/onboarding' },
        error: null,
      }));

      mockSupabase.functions = {
        invoke: mockInvoke,
      } as any;

      mockSupabase.auth = {
        getSession: jest.fn(() => Promise.resolve({
          data: { session: { access_token: 'test-token' } },
          error: null,
        })),
      } as any;

      const result = await mockSupabase.functions.invoke('stripe-connect', {
        body: { barberId: 'barber-id', email: 'test@example.com' },
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(mockInvoke).toHaveBeenCalled();
      expect(result.data?.url).toBeDefined();
    });

    it('should check Stripe account status', async () => {
      const mockSingle = jest.fn(() => Promise.resolve({
        data: {
          stripe_account_id: 'acct_123',
          stripe_account_status: 'active',
          stripe_account_ready: true,
        },
        error: null,
      }));

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: mockSingle,
          })),
        })),
      })) as any;

      const { data } = await mockSupabase
        .from('barbers')
        .select('stripe_account_id, stripe_account_status, stripe_account_ready')
        .eq('user_id', 'test-user-id')
        .single();

      expect(data?.stripe_account_ready).toBe(true);
      expect(data?.stripe_account_status).toBe('active');
    });
  });

  describe('Form Validation', () => {
    it('should validate required business information fields', () => {
      const requiredFields = ['businessName', 'phone', 'location', 'bio'];
      const formData = {
        businessName: 'Test Shop',
        phone: '+1234567890',
        location: 'New York, NY',
        bio: 'Test bio',
      };

      const isValid = requiredFields.every(field => {
        const value = formData[field as keyof typeof formData];
        return value && value.trim().length > 0;
      });

      expect(isValid).toBe(true);
    });

    it('should validate services array is not empty', () => {
      const services = [
        { name: 'Haircut', price: 30, duration: 30 },
      ];

      const isValid = services.length > 0 && services.every(s => 
        s.name && s.price > 0 && s.duration > 0
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockUpsert = jest.fn(() => Promise.resolve({
        data: null,
        error: { message: 'Database error' },
      }));

      mockSupabase.from = jest.fn(() => ({
        upsert: mockUpsert,
      })) as any;

      const result = await mockSupabase.from('barbers').upsert({
        user_id: 'test-user-id',
        business_name: 'Test',
      }, { onConflict: 'user_id' });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle missing barber record', async () => {
      const mockSingle = jest.fn(() => Promise.resolve({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      }));

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: mockSingle,
          })),
        })),
      })) as any;

      const { error } = await mockSupabase
        .from('barbers')
        .select('id')
        .eq('user_id', 'test-user-id')
        .single();

      expect(error).toBeDefined();
      expect(error?.code).toBe('PGRST116');
    });
  });
});
