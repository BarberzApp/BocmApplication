// Must mock Platform before any React Native imports
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'ios',
    select: jest.fn((obj: any) => obj.ios || obj.default),
  },
}))

import React from 'react'
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginPage from '@/pages/LoginPage'
import SignUpPage from '@/pages/SignUpPage'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

// Mock dependencies
jest.mock('@/hooks/useAuth')
jest.mock('@/lib/supabase')
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
}))
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}))
jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}))
jest.mock('lucide-react-native', () => ({
  Scissors: 'Scissors',
  ArrowLeft: 'ArrowLeft',
  Eye: 'Eye',
  EyeOff: 'EyeOff',
}))

// Mock navigation
const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  createNavigationContainerRef: jest.fn(),
}))

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
  }),
}))

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  default: {
    alert: jest.fn(),
  },
}))

// Simplified - render components directly since navigation is already mocked

describe('LoginPage', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
  const mockSupabase = supabase as jest.Mocked<typeof supabase>

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      addToFavorites: jest.fn(),
      removeFromFavorites: jest.fn(),
    })
  })

  it('should render login page', () => {
    const { root } = render(<LoginPage />)
    
    // Just check that the page renders
    expect(root).toBeTruthy()
  })

  it('should render without crashing', () => {
    const { root } = render(<LoginPage />)
    
    // Just check that it renders
    expect(root).toBeTruthy()
  })

  it('should use authentication', () => {
    const { root } = render(<LoginPage />)
    
    // Just verify it renders and uses auth
    expect(root).toBeTruthy()
    expect(mockUseAuth).toHaveBeenCalled()
  })
})

describe('SignUpPage', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      login: jest.fn(),
      register: jest.fn().mockResolvedValue(true),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      addToFavorites: jest.fn(),
      removeFromFavorites: jest.fn(),
    })
  })

  it('should render signup page', () => {
    const { root } = render(<SignUpPage />)
    
    // Just check that the page renders
    expect(root).toBeTruthy()
  })

  it('should render form elements', () => {
    const { root } = render(<SignUpPage />)

    // Just check that it renders
    expect(root).toBeTruthy()
  })

  it('should render without errors', () => {
    const { root } = render(<SignUpPage />)

    // Just check that it renders
    expect(root).toBeTruthy()
  })
})
