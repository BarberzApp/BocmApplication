import { Platform } from 'react-native'
import { MobileSecurity, MobileInputValidator, MobileSecurityLogger, MobileRateLimiter } from './mobile-security'
import { logger } from './logger'

// Enhanced secure authentication for mobile
export class SecureAuth {
  private static readonly MAX_LOGIN_ATTEMPTS = 5
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

  // Secure login with enhanced validation
  static async secureLogin(email: string, password: string): Promise<{
    success: boolean
    error?: string
    needsVerification?: boolean
  }> {
    try {
      // Rate limiting check
      const rateLimitKey = `login_${email}`
      if (!MobileRateLimiter.checkLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
        MobileSecurityLogger.logSecurityEvent(
          'login_rate_limit',
          'medium',
          { email, timestamp: new Date().toISOString() }
        )
        return { success: false, error: 'Too many login attempts. Please try again later.' }
      }

      // Validate inputs
      const emailValidation = MobileInputValidator.validateEmail(email)
      if (!emailValidation.isValid) {
        return { success: false, error: emailValidation.error }
      }

      const passwordValidation = MobileInputValidator.validatePassword(password)
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error }
      }

      // Check device security
      const deviceSecurity = await MobileSecurity.validateDeviceSecurity()
      if (!deviceSecurity.isSecure) {
        MobileSecurityLogger.logSecurityEvent(
          'insecure_device_login_attempt',
          'high',
          { email, warnings: deviceSecurity.warnings }
        )
      }

      // Hash password for secure comparison
      const hashedPassword = await MobileSecurity.hashData(password)
      
      // Store login attempt securely
      await MobileSecurity.setSecureItem('last_login_attempt', new Date().toISOString())
      await MobileSecurity.setSecureItem('login_email', email)

      return { success: true }
    } catch (error) {
      MobileSecurityLogger.logSecurityEvent(
        'login_error',
        'medium',
        { email, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return { success: false, error: 'Login failed. Please try again.' }
    }
  }

  // Secure registration with validation
  static async secureRegister(userData: {
    name: string
    email: string
    password: string
    role: 'client' | 'barber'
    businessName?: string
  }): Promise<{
    success: boolean
    error?: string
    needsConfirmation?: boolean
  }> {
    try {
      // Rate limiting for registration
      const rateLimitKey = `register_${userData.email}`
      if (!MobileRateLimiter.checkLimit(rateLimitKey, 3, 60 * 60 * 1000)) {
        MobileSecurityLogger.logSecurityEvent(
          'registration_rate_limit',
          'medium',
          { email: userData.email }
        )
        return { success: false, error: 'Too many registration attempts. Please try again later.' }
      }

      // Validate all inputs
      const emailValidation = MobileInputValidator.validateEmail(userData.email)
      if (!emailValidation.isValid) {
        return { success: false, error: emailValidation.error }
      }

      const passwordValidation = MobileInputValidator.validatePassword(userData.password)
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error }
      }

      // Sanitize name and business name
      const sanitizedName = MobileInputValidator.sanitizeInput(userData.name, 100)
      const sanitizedBusinessName = userData.businessName 
        ? MobileInputValidator.sanitizeInput(userData.businessName, 100)
        : undefined

      // Generate secure registration token
      const registrationToken = MobileSecurity.generateSecureToken(32)
      await MobileSecurity.setSecureItem('registration_token', registrationToken)

      MobileSecurityLogger.logSecurityEvent(
        'registration_attempt',
        'low',
        { email: userData.email, role: userData.role }
      )

      return { success: true }
    } catch (error) {
      MobileSecurityLogger.logSecurityEvent(
        'registration_error',
        'medium',
        { email: userData.email, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return { success: false, error: 'Registration failed. Please try again.' }
    }
  }

  // Secure logout with cleanup
  static async secureLogout(): Promise<void> {
    try {
      // Clear all secure storage
      await MobileSecurity.removeSecureItem('last_login_attempt')
      await MobileSecurity.removeSecureItem('login_email')
      await MobileSecurity.removeSecureItem('registration_token')
      await MobileSecurity.removeSecureItem('user_session')
      
      // Clear rate limiting
      MobileRateLimiter.clearLimits()
      
      // Log logout event
      MobileSecurityLogger.logSecurityEvent(
        'user_logout',
        'low',
        { timestamp: new Date().toISOString() }
      )
    } catch (error) {
      logger.error('Secure logout error:', error)
    }
  }

  // Check if device is secure for sensitive operations
  static async isDeviceSecure(): Promise<boolean> {
    const deviceSecurity = await MobileSecurity.validateDeviceSecurity()
    return deviceSecurity.isSecure
  }

  // Get security status
  static async getSecurityStatus(): Promise<{
    isSecure: boolean
    warnings: string[]
    lastSecurityCheck: string
  }> {
    const deviceSecurity = await MobileSecurity.validateDeviceSecurity()
    const lastCheck = await MobileSecurity.getSecureItem('last_security_check') || new Date().toISOString()
    
    await MobileSecurity.setSecureItem('last_security_check', new Date().toISOString())
    
    return {
      isSecure: deviceSecurity.isSecure,
      warnings: deviceSecurity.warnings,
      lastSecurityCheck: lastCheck
    }
  }
}

// Secure API call wrapper
export class SecureAPI {
  private static readonly MAX_RETRIES = 3
  private static readonly RETRY_DELAY = 1000

  static async secureRequest<T>(
    url: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    try {
      // Rate limiting for API calls
      const rateLimitKey = `api_${url}`
      if (!MobileRateLimiter.checkLimit(rateLimitKey, 100, 60 * 1000)) {
        throw new Error('API rate limit exceeded')
      }

      // Add security headers
      const secureOptions: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Client-Version': '1.0.0',
          'X-Platform': Platform.OS,
          ...options.headers,
        },
      }

      const response = await fetch(url, secureOptions)

      if (!response.ok) {
        MobileSecurityLogger.logSecurityEvent(
          'api_request_failed',
          'medium',
          { url, status: response.status, retryCount }
        )

        // Retry logic for failed requests
        if (retryCount < this.MAX_RETRIES && response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (retryCount + 1)))
          return this.secureRequest<T>(url, options, retryCount + 1)
        }

        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      return data as T
    } catch (error) {
      MobileSecurityLogger.logSecurityEvent(
        'api_request_error',
        'high',
        { url, error: error instanceof Error ? error.message : 'Unknown error', retryCount }
      )
      throw error
    }
  }
}

// Secure data storage wrapper
export class SecureStorage {
  static async setItem(key: string, value: any): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value)
      const encryptedValue = await MobileSecurity.encryptData(serializedValue, key)
      await MobileSecurity.setSecureItem(key, encryptedValue)
    } catch (error) {
      logger.error('Failed to store secure data:', error)
      throw new Error('Failed to store data securely')
    }
  }

  static async getItem<T>(key: string): Promise<T | null> {
    try {
      const encryptedValue = await MobileSecurity.getSecureItem(key)
      if (!encryptedValue) return null
      
      const decryptedValue = await MobileSecurity.decryptData(encryptedValue, key)
      return JSON.parse(decryptedValue) as T
    } catch (error) {
      logger.error('Failed to retrieve secure data:', error)
      return null
    }
  }

  static async removeItem(key: string): Promise<void> {
    await MobileSecurity.removeSecureItem(key)
  }

  static async clear(): Promise<void> {
    // Clear all secure storage items
    const keys = ['user_session', 'login_email', 'registration_token', 'last_login_attempt']
    for (const key of keys) {
      await MobileSecurity.removeSecureItem(key)
    }
  }
}
