import { useState, useEffect, useCallback } from 'react'
import { Alert, Platform } from 'react-native'
import { 
  MobileSecurity, 
  MobileSecurityLogger, 
  SecureAuth, 
  SecureStorage,
  mobileSecurityConfig,
  checkSecurityStatus
} from '../lib/mobile-security-config'

// Security hook for React Native components
export const useMobileSecurity = () => {
  const [securityStatus, setSecurityStatus] = useState({
    isSecure: true,
    warnings: [] as string[],
    lastCheck: new Date().toISOString(),
  })
  const [isLoading, setIsLoading] = useState(true)

  // Check security status
  const checkSecurity = useCallback(async () => {
    try {
      setIsLoading(true)
      const status = await SecureAuth.getSecurityStatus()
      const deviceStatus = await checkSecurityStatus()
      
      setSecurityStatus({
        isSecure: status.isSecure && deviceStatus.deviceSecure,
        warnings: [...status.warnings, ...deviceStatus.recommendations],
        lastCheck: status.lastSecurityCheck,
      })
    } catch (error) {
      console.error('Security check failed:', error)
      MobileSecurityLogger.logSecurityEvent(
        'security_check_failed',
        'high',
        { error: error.message }
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Secure login
  const secureLogin = useCallback(async (email: string, password: string) => {
    try {
      const result = await SecureAuth.secureLogin(email, password)
      
      if (!result.success) {
        Alert.alert('Login Failed', result.error)
        return false
      }
      
      return true
    } catch (error) {
      console.error('Secure login error:', error)
      Alert.alert('Error', 'Login failed. Please try again.')
      return false
    }
  }, [])

  // Secure registration
  const secureRegister = useCallback(async (userData: {
    name: string
    email: string
    password: string
    role: 'client' | 'barber'
    businessName?: string
  }) => {
    try {
      const result = await SecureAuth.secureRegister(userData)
      
      if (!result.success) {
        Alert.alert('Registration Failed', result.error)
        return false
      }
      
      return true
    } catch (error) {
      console.error('Secure registration error:', error)
      Alert.alert('Error', 'Registration failed. Please try again.')
      return false
    }
  }, [])

  // Secure logout
  const secureLogout = useCallback(async () => {
    try {
      await SecureAuth.secureLogout()
      await SecureStorage.clear()
      Alert.alert('Success', 'Logged out securely')
    } catch (error) {
      console.error('Secure logout error:', error)
      Alert.alert('Error', 'Logout failed')
    }
  }, [])

  // Store sensitive data securely
  const storeSecureData = useCallback(async (key: string, data: any) => {
    try {
      await SecureStorage.setItem(key, data)
      return true
    } catch (error) {
      console.error('Failed to store secure data:', error)
      MobileSecurityLogger.logSecurityEvent(
        'secure_storage_failed',
        'medium',
        { key, error: error.message }
      )
      return false
    }
  }, [])

  // Retrieve sensitive data securely
  const getSecureData = useCallback(async <T>(key: string): Promise<T | null> => {
    try {
      return await SecureStorage.getItem<T>(key)
    } catch (error) {
      console.error('Failed to retrieve secure data:', error)
      MobileSecurityLogger.logSecurityEvent(
        'secure_retrieval_failed',
        'medium',
        { key, error: error.message }
      )
      return null
    }
  }, [])

  // Show security warnings
  const showSecurityWarnings = useCallback(() => {
    if (securityStatus.warnings.length > 0) {
      Alert.alert(
        'Security Notice',
        securityStatus.warnings.join('\n\n'),
        [{ text: 'OK' }]
      )
    }
  }, [securityStatus.warnings])

  // Generate secure token
  const generateSecureToken = useCallback((length: number = 32) => {
    return MobileSecurity.generateSecureToken(length)
  }, [])

  // Hash sensitive data
  const hashData = useCallback(async (data: string) => {
    try {
      return await MobileSecurity.hashData(data)
    } catch (error) {
      console.error('Hashing failed:', error)
      return null
    }
  }, [])

  // Check if device is secure
  const isDeviceSecure = useCallback(async () => {
    try {
      return await SecureAuth.isDeviceSecure()
    } catch (error) {
      console.error('Device security check failed:', error)
      return false
    }
  }, [])

  // Get security events
  const getSecurityEvents = useCallback(async () => {
    try {
      return await MobileSecurityLogger.getSecurityEvents()
    } catch (error) {
      console.error('Failed to get security events:', error)
      return []
    }
  }, [])

  // Clear security events
  const clearSecurityEvents = useCallback(() => {
    MobileSecurityLogger.clearSecurityEvents()
  }, [])

  // Initialize security on mount
  useEffect(() => {
    checkSecurity()
    
    // Check security status every 5 minutes
    const interval = setInterval(checkSecurity, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [checkSecurity])

  return {
    // Security status
    securityStatus,
    isLoading,
    
    // Security actions
    checkSecurity,
    secureLogin,
    secureRegister,
    secureLogout,
    
    // Secure storage
    storeSecureData,
    getSecureData,
    
    // Security utilities
    generateSecureToken,
    hashData,
    isDeviceSecure,
    
    // Security monitoring
    getSecurityEvents,
    clearSecurityEvents,
    showSecurityWarnings,
    
    // Configuration
    config: mobileSecurityConfig,
  }
}

// Hook for secure API calls
export const useSecureAPI = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const secureRequest = useCallback(async <T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T | null> => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Import SecureAPI dynamically to avoid circular imports
      const { SecureAPI } = await import('../lib/secure-auth')
      const result = await SecureAPI.secureRequest<T>(url, options)
      
      return result
    } catch (error) {
      console.error('Secure API request failed:', error)
      setError(error.message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    secureRequest,
    isLoading,
    error,
  }
}

// Hook for input validation
export const useInputValidation = () => {
  const validateEmail = useCallback((email: string) => {
    const { MobileInputValidator } = require('../lib/mobile-security')
    return MobileInputValidator.validateEmail(email)
  }, [])

  const validatePassword = useCallback((password: string) => {
    const { MobileInputValidator } = require('../lib/mobile-security')
    return MobileInputValidator.validatePassword(password)
  }, [])

  const validatePhoneNumber = useCallback((phone: string) => {
    const { MobileInputValidator } = require('../lib/mobile-security')
    return MobileInputValidator.validatePhoneNumber(phone)
  }, [])

  const sanitizeInput = useCallback((input: string, maxLength?: number) => {
    const { MobileInputValidator } = require('../lib/mobile-security')
    return MobileInputValidator.sanitizeInput(input, maxLength)
  }, [])

  return {
    validateEmail,
    validatePassword,
    validatePhoneNumber,
    sanitizeInput,
  }
}
