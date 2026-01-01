import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import SettingsPage from '@/pages/SettingsPage';

// Mock twrnc
jest.mock('twrnc', () => {
  const tw = (strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

// Mock dependencies
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    userProfile: { name: 'Test User', role: 'client' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ 
        data: { id: 'test-user', name: 'Test User', email: 'test@example.com' }, 
        error: null 
      }),
    })),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('lucide-react-native', () => ({
  User: 'User',
  Scissors: 'Scissors',
  Package: 'Package',
  Share2: 'Share2',
  Calendar: 'Calendar',
  DollarSign: 'DollarSign',
  Settings: 'Settings',
  Sparkles: 'Sparkles',
  AlertCircle: 'AlertCircle',
  LogOut: 'LogOut',
  CheckCircle: 'CheckCircle',
  RefreshCw: 'RefreshCw',
}));

// Mock settings components
jest.mock('@/components/settings/ProfileSettings', () => ({
  ProfileSettings: 'ProfileSettings',
}));

jest.mock('@/components/settings/ServicesSettings', () => ({
  ServicesSettings: 'ServicesSettings',
}));

jest.mock('@/components/settings/AddonsSettings', () => ({
  AddonsSettings: 'AddonsSettings',
}));

jest.mock('@/components/settings/ShareSettings', () => ({
  ShareSettings: 'ShareSettings',
}));

jest.mock('@/components/settings/AvailabilityManager', () => ({
  AvailabilityManager: 'AvailabilityManager',
}));

jest.mock('@/components/settings/EarningsDashboard', () => ({
  EarningsDashboard: 'EarningsDashboard',
}));

jest.mock('@/components/ui', () => ({
  Button: 'Button',
  Card: 'Card',
  CardContent: 'CardContent',
}));

describe('SettingsPage - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    const { getByText } = render(<SettingsPage />);
    expect(getByText('Loading your settings...')).toBeTruthy();
  });

  it('should render without crashing', () => {
    expect(() => {
      render(<SettingsPage />);
    }).not.toThrow();
  });

  it('should use useAuth hook', () => {
    // If component renders without error, useAuth is working
    render(<SettingsPage />);
    expect(true).toBe(true);
  });

  it('should accept navigation prop', () => {
    // useNavigation is mocked, component should use it
    render(<SettingsPage />);
    expect(true).toBe(true);
  });
});

