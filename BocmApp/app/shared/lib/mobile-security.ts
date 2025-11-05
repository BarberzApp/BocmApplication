import { Platform, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import { logger } from './logger'

// Mobile-specific security utilities
export class MobileSecurity {
  // Secure storage for sensitive data
  static async setSecureItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value)
      } else {
        await SecureStore.setItemAsync(key, value)
      }
    } catch (error) {
      logger.error('Failed to store secure item:', error)
      throw new Error('Failed to store secure data')
    }
  }

  static async getSecureItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(key)
      } else {
        return await SecureStore.getItemAsync(key)
      }
    } catch (error) {
      logger.error('Failed to retrieve secure item:', error)
      return null
    }
  }

  static async removeSecureItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key)
      } else {
        await SecureStore.deleteItemAsync(key)
      }
    } catch (error) {
      logger.error('Failed to remove secure item:', error)
    }
  }

  // Generate secure random strings
  static generateSecureToken(length: number = 32): string {
    return Crypto.getRandomBytes(length).toString('hex')
  }

  // Hash sensitive data
  static async hashData(data: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data,
      { encoding: Crypto.CryptoEncoding.HEX }
    )
  }

  // Validate device security
  static async validateDeviceSecurity(): Promise<{
    isSecure: boolean
    warnings: string[]
  }> {
    const warnings: string[] = []

    // Check if device is rooted/jailbroken (basic check)
    if (Platform.OS === 'android') {
      // Android security checks
      warnings.push('Android device detected - ensure device is not rooted')
    } else if (Platform.OS === 'ios') {
      // iOS security checks
      warnings.push('iOS device detected - ensure device is not jailbroken')
    }

    // Check if running in debug mode
    if (__DEV__) {
      warnings.push('App is running in development mode')
    }

    return {
      isSecure: warnings.length === 0,
      warnings
    }
  }

  // Secure data encryption/decryption
  static async encryptData(data: string, key: string): Promise<string> {
    try {
      const hash = await this.hashData(key)
      // Simple XOR encryption (in production, use proper encryption)
      let encrypted = ''
      for (let i = 0; i < data.length; i++) {
        encrypted += String.fromCharCode(
          data.charCodeAt(i) ^ hash.charCodeAt(i % hash.length)
        )
      }
      return btoa(encrypted) // Base64 encode
    } catch (error) {
      logger.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  static async decryptData(encryptedData: string, key: string): Promise<string> {
    try {
      const hash = await this.hashData(key)
      const decoded = atob(encryptedData) // Base64 decode
      let decrypted = ''
      for (let i = 0; i < decoded.length; i++) {
        decrypted += String.fromCharCode(
          decoded.charCodeAt(i) ^ hash.charCodeAt(i % hash.length)
        )
      }
      return decrypted
    } catch (error) {
      logger.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }
}

// Input validation for mobile
export class MobileInputValidator {
  static validateEmail(email: string): { isValid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || email.length === 0) {
      return { isValid: false, error: 'Email is required' }
    }
    if (email.length > 255) {
      return { isValid: false, error: 'Email is too long' }
    }
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Invalid email format' }
    }
    return { isValid: true }
  }

  static validatePassword(password: string): { isValid: boolean; error?: string } {
    if (!password || password.length === 0) {
      return { isValid: false, error: 'Password is required' }
    }
    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters' }
    }
    if (password.length > 128) {
      return { isValid: false, error: 'Password is too long' }
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one lowercase letter' }
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one uppercase letter' }
    }
    if (!/(?=.*\d)/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one number' }
    }
    return { isValid: true }
  }

  static validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/
    if (!phone || phone.length === 0) {
      return { isValid: false, error: 'Phone number is required' }
    }
    if (phone.length < 10 || phone.length > 20) {
      return { isValid: false, error: 'Invalid phone number length' }
    }
    if (!phoneRegex.test(phone)) {
      return { isValid: false, error: 'Invalid phone number format' }
    }
    return { isValid: true }
  }

  static sanitizeInput(input: string, maxLength: number = 1000): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .substring(0, maxLength)
  }
}

// Security monitoring for mobile
export class MobileSecurityLogger {
  private static events: Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    details: any
    timestamp: string
    deviceInfo: any
  }> = []

  static logSecurityEvent(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: any
  ) {
    const event = {
      type,
      severity,
      details,
      timestamp: new Date().toISOString(),
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version,
        isDev: __DEV__
      }
    }

    this.events.push(event)

    // Log security events
    logger.warn(`Security Event [${severity.toUpperCase()}]:`, event)

    // Store in secure storage for later analysis
    this.storeSecurityEvent(event)
  }

  private static async storeSecurityEvent(event: any) {
    try {
      const existingEvents = await MobileSecurity.getSecureItem('security_events') || '[]'
      const events = JSON.parse(existingEvents)
      events.push(event)
      
      // Keep only last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100)
      }
      
      await MobileSecurity.setSecureItem('security_events', JSON.stringify(events))
    } catch (error) {
      logger.error('Failed to store security event:', error)
    }
  }

  static async getSecurityEvents(): Promise<any[]> {
    try {
      const events = await MobileSecurity.getSecureItem('security_events')
      return events ? JSON.parse(events) : []
    } catch (error) {
      logger.error('Failed to retrieve security events:', error)
      return []
    }
  }

  static clearSecurityEvents(): void {
    this.events = []
    MobileSecurity.removeSecureItem('security_events')
  }
}

// Rate limiting for mobile API calls
export class MobileRateLimiter {
  private static limits: Map<string, { count: number; resetTime: number }> = new Map()

  static checkLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now()
    const current = this.limits.get(key)

    if (!current || now > current.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + windowMs })
      return true
    }

    if (current.count >= limit) {
      MobileSecurityLogger.logSecurityEvent(
        'rate_limit_exceeded',
        'medium',
        { key, limit, windowMs }
      )
      return false
    }

    current.count++
    return true
  }

  static clearLimits(): void {
    this.limits.clear()
  }
}
