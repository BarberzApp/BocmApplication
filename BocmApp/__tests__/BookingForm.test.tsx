import React from 'react';
import { render } from '@testing-library/react-native';
import BookingForm from '../app/shared/components/BookingForm';

// Mock dependencies to keep tests simple
jest.mock('twrnc', () => {
  const tw = (strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

jest.mock('date-fns', () => ({
  format: jest.fn(() => '2024-01-01'),
  addDays: jest.fn((date, days) => new Date()),
  isToday: jest.fn(() => false),
  isSameDay: jest.fn(() => false),
}));

jest.mock('../app/shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    userProfile: { name: 'Test User' },
  }),
}));

jest.mock('../app/shared/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: { is_developer: false }, error: null }),
    })),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-native-vector-icons/Feather', () => 'Icon');
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@stripe/stripe-react-native', () => ({
  initStripe: jest.fn(),
  confirmPayment: jest.fn(),
  presentPaymentSheet: jest.fn(),
  CardField: 'CardField',
}));

jest.mock('../app/shared/lib/bookingService', () => ({
  bookingService: {
    getBarberServices: jest.fn().mockResolvedValue([
      { id: 'service-1', name: 'Haircut', description: 'Basic haircut', price: 30, duration: 30 },
    ]),
    getAvailableSlots: jest.fn().mockResolvedValue([
      { time: '09:00', available: true },
    ]),
  },
}));

jest.mock('../app/shared/lib/notifications', () => ({
  notificationService: { scheduleBookingReminder: jest.fn() },
  formatAppointmentTime: jest.fn(() => '9:00 AM'),
}));

describe('BookingForm - Basic Tests', () => {
  const mockProps = {
    isVisible: false, // Start with false to avoid Modal rendering issues
    onClose: jest.fn(),
    barberId: 'test-barber-id',
    barberName: 'Test Barber',
    onBookingCreated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render modal when isVisible is false', () => {
    const { queryByText } = render(<BookingForm {...mockProps} />);
    // Modal should not render any content when not visible
    expect(queryByText('Choose Your Service')).toBeNull();
  });

  it('should accept required props without crashing', () => {
    // Just verify the component accepts the props
    expect(() => {
      render(<BookingForm {...mockProps} />);
    }).not.toThrow();
  });

  it('should accept optional preSelectedService prop', () => {
    const preSelectedService = {
      id: 'service-1',
      name: 'Haircut',
      description: 'Basic haircut',
      price: 30,
      duration: 30,
    };
    
    expect(() => {
      render(<BookingForm {...mockProps} preSelectedService={preSelectedService} />);
    }).not.toThrow();
  });
});
