import React from 'react'
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginPage from '../app/pages/LoginPage'
import SignUpPage from '../app/pages/SignUpPage'
import { useAuth } from '../app/shared/hooks/useAuth'
import { supabase } from '../app/shared/lib/supabase'

// Mock dependencies
jest.mock('../app/shared/hooks/useAuth')
jest.mock('../app/shared/lib/supabase')
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
}))
jest.mock('expo-linear-gradient', () => 'LinearGradient')
jest.mock('expo-blur', () => 'BlurView')
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
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}))

// Mock Alert
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Alert: {
    alert: jest.fn(),
  },
}))

const Stack = createNativeStackNavigator()

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NavigationContainer>
    <Stack.Navigator>
      <Stack.Screen name="Test" component={() => <>{children}</>} />
    </Stack.Navigator>
  </NavigationContainer>
)

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

  it('should render login form correctly', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
    expect(screen.getByPlaceholderText('Password')).toBeTruthy()
    expect(screen.getByText('Sign In')).toBeTruthy()
    expect(screen.getByText('Sign Up')).toBeTruthy()
  })

  it('should handle email input', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const emailInput = screen.getByPlaceholderText('Email')
    fireEvent.changeText(emailInput, 'test@example.com')

    expect(emailInput.props.value).toBe('test@example.com')
  })

  it('should handle password input', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const passwordInput = screen.getByPlaceholderText('Password')
    fireEvent.changeText(passwordInput, 'password123')

    expect(passwordInput.props.value).toBe('password123')
  })

  it('should toggle password visibility', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const passwordInput = screen.getByPlaceholderText('Password')
    const toggleButton = screen.getByTestId('password-toggle')

    // Initially password should be hidden
    expect(passwordInput.props.secureTextEntry).toBe(true)

    // Toggle visibility
    fireEvent.press(toggleButton)
    expect(passwordInput.props.secureTextEntry).toBe(false)

    // Toggle back
    fireEvent.press(toggleButton)
    expect(passwordInput.props.secureTextEntry).toBe(true)
  })

  it('should navigate to sign up page', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const signUpButton = screen.getByText('Sign Up')
    fireEvent.press(signUpButton)

    expect(mockNavigate).toHaveBeenCalledWith('SignUp')
  })

  it('should handle successful login', async () => {
    const mockLogin = jest.fn().mockResolvedValue(true)
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      addToFavorites: jest.fn(),
      removeFromFavorites: jest.fn(),
    })

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const emailInput = screen.getByPlaceholderText('Email')
    const passwordInput = screen.getByPlaceholderText('Password')
    const signInButton = screen.getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.press(signInButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('should handle login error', async () => {
    const mockLogin = jest.fn().mockResolvedValue(false)
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      addToFavorites: jest.fn(),
      removeFromFavorites: jest.fn(),
    })

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const emailInput = screen.getByPlaceholderText('Email')
    const passwordInput = screen.getByPlaceholderText('Password')
    const signInButton = screen.getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'wrongpassword')
    fireEvent.press(signInButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'wrongpassword')
    })
  })

  it('should handle forgot password', async () => {
    mockSupabase.auth.resetPasswordForEmail = jest.fn().mockResolvedValue({ error: null })

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const emailInput = screen.getByPlaceholderText('Email')
    const forgotPasswordButton = screen.getByText('Forgot Password?')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.press(forgotPasswordButton)

    await waitFor(() => {
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com')
    })
  })

  it('should show error when forgot password without email', () => {
    const { Alert } = require('react-native')

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const forgotPasswordButton = screen.getByText('Forgot Password?')
    fireEvent.press(forgotPasswordButton)

    expect(Alert.alert).toHaveBeenCalledWith('Enter Email', 'Please enter your email address first')
  })

  it('should handle Google sign in', () => {
    const { Alert } = require('react-native')

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const googleSignInButton = screen.getByText('Continue with Google')
    fireEvent.press(googleSignInButton)

    expect(Alert.alert).toHaveBeenCalledWith('Coming Soon', 'Google Sign-In will be available soon!')
  })

  it('should handle back navigation', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    )

    const backButton = screen.getByTestId('back-button')
    fireEvent.press(backButton)

    expect(mockGoBack).toHaveBeenCalled()
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
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      addToFavorites: jest.fn(),
      removeFromFavorites: jest.fn(),
    })
  })

  it('should render signup form correctly', () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    expect(screen.getByPlaceholderText('Full Name')).toBeTruthy()
    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
    expect(screen.getByPlaceholderText('Password')).toBeTruthy()
    expect(screen.getByPlaceholderText('Confirm Password')).toBeTruthy()
    expect(screen.getByText('Create Account')).toBeTruthy()
  })

  it('should handle user type selection', () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const barberButton = screen.getByText('Barber')
    fireEvent.press(barberButton)

    // Should show business name field for barbers
    expect(screen.getByPlaceholderText('Business Name (Optional)')).toBeTruthy()
  })

  it('should handle form input', () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const fullNameInput = screen.getByPlaceholderText('Full Name')
    const emailInput = screen.getByPlaceholderText('Email')
    const passwordInput = screen.getByPlaceholderText('Password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password')

    fireEvent.changeText(fullNameInput, 'John Doe')
    fireEvent.changeText(emailInput, 'john@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.changeText(confirmPasswordInput, 'password123')

    expect(fullNameInput.props.value).toBe('John Doe')
    expect(emailInput.props.value).toBe('john@example.com')
    expect(passwordInput.props.value).toBe('password123')
    expect(confirmPasswordInput.props.value).toBe('password123')
  })

  it('should toggle password visibility', () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const passwordInput = screen.getByPlaceholderText('Password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password')
    const togglePasswordButton = screen.getByTestId('password-toggle')
    const toggleConfirmPasswordButton = screen.getByTestId('confirm-password-toggle')

    // Initially passwords should be hidden
    expect(passwordInput.props.secureTextEntry).toBe(true)
    expect(confirmPasswordInput.props.secureTextEntry).toBe(true)

    // Toggle password visibility
    fireEvent.press(togglePasswordButton)
    expect(passwordInput.props.secureTextEntry).toBe(false)

    // Toggle confirm password visibility
    fireEvent.press(toggleConfirmPasswordButton)
    expect(confirmPasswordInput.props.secureTextEntry).toBe(false)
  })

  it('should handle terms agreement', () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const termsCheckbox = screen.getByTestId('terms-checkbox')
    fireEvent.press(termsCheckbox)

    expect(termsCheckbox.props.accessibilityState.checked).toBe(true)
  })

  it('should validate form fields', async () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const createAccountButton = screen.getByText('Create Account')
    fireEvent.press(createAccountButton)

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeTruthy()
      expect(screen.getByText('Email is required')).toBeTruthy()
      expect(screen.getByText('Password is required')).toBeTruthy()
    })
  })

  it('should validate password match', async () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const passwordInput = screen.getByPlaceholderText('Password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password')
    const createAccountButton = screen.getByText('Create Account')

    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.changeText(confirmPasswordInput, 'differentpassword')
    fireEvent.press(createAccountButton)

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeTruthy()
    })
  })

  it('should handle successful registration', async () => {
    const mockRegister = jest.fn().mockResolvedValue(true)
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      login: jest.fn(),
      register: mockRegister,
      logout: jest.fn(),
      updateProfile: jest.fn(),
      addToFavorites: jest.fn(),
      removeFromFavorites: jest.fn(),
    })

    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const fullNameInput = screen.getByPlaceholderText('Full Name')
    const emailInput = screen.getByPlaceholderText('Email')
    const passwordInput = screen.getByPlaceholderText('Password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password')
    const termsCheckbox = screen.getByTestId('terms-checkbox')
    const createAccountButton = screen.getByText('Create Account')

    fireEvent.changeText(fullNameInput, 'John Doe')
    fireEvent.changeText(emailInput, 'john@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.changeText(confirmPasswordInput, 'password123')
    fireEvent.press(termsCheckbox)
    fireEvent.press(createAccountButton)

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'John Doe',
        'john@example.com',
        'password123',
        'client',
        undefined
      )
    })
  })

  it('should handle barber registration with business name', async () => {
    const mockRegister = jest.fn().mockResolvedValue(true)
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      login: jest.fn(),
      register: mockRegister,
      logout: jest.fn(),
      updateProfile: jest.fn(),
      addToFavorites: jest.fn(),
      removeFromFavorites: jest.fn(),
    })

    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    // Select barber user type
    const barberButton = screen.getByText('Barber')
    fireEvent.press(barberButton)

    const fullNameInput = screen.getByPlaceholderText('Full Name')
    const emailInput = screen.getByPlaceholderText('Email')
    const passwordInput = screen.getByPlaceholderText('Password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password')
    const businessNameInput = screen.getByPlaceholderText('Business Name (Optional)')
    const termsCheckbox = screen.getByTestId('terms-checkbox')
    const createAccountButton = screen.getByText('Create Account')

    fireEvent.changeText(fullNameInput, 'Jane Barber')
    fireEvent.changeText(emailInput, 'jane@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.changeText(confirmPasswordInput, 'password123')
    fireEvent.changeText(businessNameInput, 'Jane\'s Barber Shop')
    fireEvent.press(termsCheckbox)
    fireEvent.press(createAccountButton)

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'Jane Barber',
        'jane@example.com',
        'password123',
        'barber',
        'Jane\'s Barber Shop'
      )
    })
  })

  it('should navigate to login page', () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const loginLink = screen.getByText('Already have an account? Sign In')
    fireEvent.press(loginLink)

    expect(mockNavigate).toHaveBeenCalledWith('Login')
  })

  it('should navigate to terms page', () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const termsLink = screen.getByText('Terms of Service')
    fireEvent.press(termsLink)

    expect(mockNavigate).toHaveBeenCalledWith('Terms')
  })

  it('should handle back navigation', () => {
    render(
      <TestWrapper>
        <SignUpPage />
      </TestWrapper>
    )

    const backButton = screen.getByTestId('back-button')
    fireEvent.press(backButton)

    expect(mockGoBack).toHaveBeenCalled()
  })
})




