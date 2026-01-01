// Mock Platform before any imports
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  Version: '15.0',
  select: jest.fn((obj) => obj.ios || obj.default),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EmailConfirmationScreen from '@/pages/EmailConfirmationScreen';

// Mock navigation and route
const mockRouteParams: { email?: string } = { email: 'test@example.com' };
const mockReplace = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    replace: mockReplace,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

// Mock useAuth
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

// Mock supabase
const mockResend = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resend: (...args: any[]) => mockResend(...args),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
    },
  },
}));

// Mock Alert
const mockAlert = jest.fn();
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (...args: any[]) => mockAlert(...args),
}));

// Mock AnimatedBackground to simple view
jest.mock('@/components/AnimatedBackground', () => ({
  AnimatedBackground: () => null,
}));

// Mock UI components used inside
jest.mock('@/components/ui', () => ({
  Card: ({ children }: any) => children,
  CardContent: ({ children }: any) => children,
}));

jest.mock('@/components/ui/Button', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return ({ onPress, children, style }: any) => (
    <TouchableOpacity onPress={onPress} style={style} testID="button">
      {typeof children === 'string' ? <Text>{children}</Text> : children}
    </TouchableOpacity>
  );
});

describe('EmailConfirmationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resends confirmation email on button press', async () => {
    mockRouteParams.email = 'test@example.com';
    mockResend.mockResolvedValueOnce({ error: null });

    const { getByText } = render(<EmailConfirmationScreen />);

    fireEvent.press(getByText('Resend email'));

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.com',
      });
      expect(mockAlert).toHaveBeenCalledWith(
        'Email Sent',
        "We've sent another confirmation email. Please check your inbox."
      );
    });
  });

  it('shows error alert when resend fails', async () => {
    mockRouteParams.email = 'test@example.com';
    mockResend.mockResolvedValueOnce({ error: { message: 'boom' } });

    const { getByText } = render(<EmailConfirmationScreen />);

    fireEvent.press(getByText('Resend email'));

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'Failed to resend confirmation email. Please try again.'
      );
    });
  });

  it('blocks resend when email is missing', async () => {
    mockRouteParams.email = undefined;
    const { getByText } = render(<EmailConfirmationScreen />);

    fireEvent.press(getByText('Resend email'));

    await waitFor(() => {
      expect(mockResend).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith(
        'Missing email',
        'We need your email to resend the confirmation. Please log in again or restart signup.'
      );
    });
  });
});

