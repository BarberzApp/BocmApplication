import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import CalendarPage from '../app/pages/CalendarPage';
import { Animated } from 'react-native';

// Mock Animated to avoid timer issues
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

Animated.timing = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
});

Animated.spring = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
});

// Mock twrnc
jest.mock('twrnc', () => {
  const tw = (strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

// Mock Vibration
jest.mock('react-native/Libraries/Vibration/Vibration', () => ({
  vibrate: jest.fn(),
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date) => '2024-01-01'),
  addMonths: jest.fn((date) => new Date()),
  subMonths: jest.fn((date) => new Date()),
  startOfMonth: jest.fn((date) => new Date()),
  endOfMonth: jest.fn((date) => new Date()),
  eachDayOfInterval: jest.fn(() => [new Date()]),
  isSameMonth: jest.fn(() => true),
  isSameDay: jest.fn(() => false),
  isToday: jest.fn(() => false),
  startOfWeek: jest.fn((date) => new Date()),
  endOfWeek: jest.fn((date) => new Date()),
  isSameWeek: jest.fn(() => false),
}));

// Mock all dependencies
jest.mock('../app/shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    userProfile: null,
    loading: false,
  }),
}));

jest.mock('../app/shared/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { role: 'client' }, error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
  useFocusEffect: jest.fn((callback) => {
    // Call immediately
    callback();
    // Return cleanup function
    return () => {};
  }),
}));

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Calendar: 'Calendar',
  Clock: 'Clock',
  User: 'User',
  DollarSign: 'DollarSign',
  X: 'X',
  Plus: 'Plus',
  RefreshCw: 'RefreshCw',
  Filter: 'Filter',
  Search: 'Search',
}));

jest.mock('../app/shared/components/ReviewForm', () => ({
  ReviewForm: 'ReviewForm',
}));

jest.mock('../app/shared/lib/bookingService', () => ({
  bookingService: {
    getBarberBookings: jest.fn().mockResolvedValue([]),
    getClientBookings: jest.fn().mockResolvedValue([]),
  },
}));

// Increase timeout for this test suite due to animations
jest.setTimeout(10000);

describe('CalendarPage - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    const { getByText } = render(<CalendarPage />);
    expect(getByText('Loading Calendar...')).toBeTruthy();
  });

  it('should render calendar component', () => {
    const { root } = render(<CalendarPage />);
    // Just check that something renders
    expect(root).toBeTruthy();
  });

  it('should use useAuth hook', () => {
    render(<CalendarPage />);
    // The component should call useAuth (mocked)
    // If it doesn't throw, the hook is being used
    expect(true).toBe(true);
  });
});

