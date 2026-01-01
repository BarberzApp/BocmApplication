import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BrowsePage from '@/pages/BrowsePage';

// Mock twrnc - needs to be a function that returns style objects
jest.mock('twrnc', () => {
  const tw = (strings: any) => ({});
  tw.style = jest.fn(() => ({}));
  return { __esModule: true, default: tw };
});

// Mock all dependencies
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    userProfile: null,
    loading: false,
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  Accuracy: { High: 4 },
}));

jest.mock('lucide-react-native', () => ({
  Search: 'Search',
  MapPin: 'MapPin',
  Filter: 'Filter',
  X: 'X',
  Grid3X3: 'Grid3X3',
  Heart: 'Heart',
  Scissors: 'Scissors',
  Star: 'Star',
}));

jest.mock('@/components/StaircaseGrid', () => 'StaircaseGrid');
jest.mock('@/components/BookingForm', () => 'BookingForm');
jest.mock('@/pages/ProfilePreview', () => 'ProfilePreview');
jest.mock('@/components/ReviewCard', () => ({ ReviewCard: 'ReviewCard' }));
jest.mock('@/components/ReviewForm', () => ({ ReviewForm: 'ReviewForm' }));
jest.mock('@/hooks/useReviews', () => ({
  useReviews: () => ({ stats: null, loading: false }),
}));
jest.mock('@/components/ui', () => ({ Avatar: 'Avatar' }));

describe('BrowsePage - Basic Tests', () => {
  it('should render browse page', () => {
    const { getByText } = render(<BrowsePage />);
    expect(getByText('Browse')).toBeTruthy();
  });

  it('should render search input', () => {
    const { getByPlaceholderText } = render(<BrowsePage />);
    expect(getByPlaceholderText('Search stylists...')).toBeTruthy();
  });

  it('should handle search text input', () => {
    const { getByPlaceholderText } = render(<BrowsePage />);
    const searchInput = getByPlaceholderText('Search stylists...');
    
    fireEvent.changeText(searchInput, 'test barber');
    expect(searchInput.props.value).toBe('test barber');
  });

  it('should show filters when filter button is pressed', async () => {
    const { getByTestId, getByText } = render(<BrowsePage />);
    const filterButton = getByTestId('filter-button');
    
    fireEvent.press(filterButton);
    
    await waitFor(() => {
      expect(getByText('Specialties')).toBeTruthy();
    });
  });

  it('should show loading state initially', () => {
    const { getByText } = render(<BrowsePage />);
    expect(getByText('Loading stylists...')).toBeTruthy();
  });

  it('should render cosmetologists view mode button', () => {
    const { getByText } = render(<BrowsePage />);
    expect(getByText('Cosmetologists')).toBeTruthy();
  });
});

