import { MobileSecurity, MobileInputValidator, MobileSecurityLogger, MobileRateLimiter } from '../app/shared/lib/mobile-security'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// Mock the dependencies
jest.mock('@react-native-async-storage/async-storage')
jest.mock('expo-secure-store')
jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn(() => ({ toString: () => 'mock-token' })),
  digestStringAsync: jest.fn(() => Promise.resolve('mock-hash')),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  CryptoEncoding: { HEX: 'hex' },
}))
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '15.0' },
}))

// Type the mocked functions
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>
const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>



describe('MobileSecurity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('setSecureItem', () => {
    it('should use SecureStore on native platforms', async () => {
      Platform.OS = 'ios'
      await MobileSecurity.setSecureItem('test-key', 'test-value')
      
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith('test-key', 'test-value')
      expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled()
    })

    it('should use AsyncStorage on web platform', async () => {
      Platform.OS = 'web'
      await MobileSecurity.setSecureItem('test-key', 'test-value')
      
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value')
      expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      Platform.OS = 'ios'
      mockedSecureStore.setItemAsync.mockRejectedValueOnce(new Error('Storage error'))
      
      await expect(MobileSecurity.setSecureItem('test-key', 'test-value'))
        .rejects.toThrow('Failed to store secure data')
    })
  })

  describe('getSecureItem', () => {
    it('should retrieve from SecureStore on native platforms', async () => {
      Platform.OS = 'ios'
      mockedSecureStore.getItemAsync.mockResolvedValueOnce('test-value')
      
      const result = await MobileSecurity.getSecureItem('test-key')
      
      expect(result).toBe('test-value')
      expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith('test-key')
    })

    it('should return null on error', async () => {
      Platform.OS = 'ios'
      mockedSecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'))
      
      const result = await MobileSecurity.getSecureItem('test-key')
      
      expect(result).toBeNull()
    })
  })

  describe('generateSecureToken', () => {
    it('should generate a secure token', () => {
      const token = MobileSecurity.generateSecureToken(16)
      
      expect(token).toBe('mock-token')
      expect(typeof token).toBe('string')
    })
  })

  describe('hashData', () => {
    it('should hash data using SHA256', async () => {
      const result = await MobileSecurity.hashData('test-data')
      
      expect(result).toBe('mock-hash')
      expect(typeof result).toBe('string')
    })
  })

  describe('validateDeviceSecurity', () => {
    it('should return security status', async () => {
      const result = await MobileSecurity.validateDeviceSecurity()
      
      expect(result).toHaveProperty('isSecure')
      expect(result).toHaveProperty('warnings')
      expect(Array.isArray(result.warnings)).toBe(true)
    })


describe('MobileInputValidator', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = ['test@example.com', 'user.name@domain.co.uk']
      
      validEmails.forEach(email => {
        const result = MobileInputValidator.validateEmail(email)
        expect(result.isValid).toBe(true)
      })
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = ['invalid-email', '@example.com', '']
      
      invalidEmails.forEach(email => {
        const result = MobileInputValidator.validateEmail(email)
        expect(result.isValid).toBe(false)
        expect(result.error).toBeDefined()
      })
    })
  })

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = ['Password123!', 'MyStr0ng#Pass']
      
      strongPasswords.forEach(password => {
        const result = MobileInputValidator.validatePassword(password)
        expect(result.isValid).toBe(true)
      })
    })

    it('should reject weak passwords', () => {
      const weakPasswords = ['12345678', 'password', 'Pass123', '']
      
      weakPasswords.forEach(password => {
        const result = MobileInputValidator.validatePassword(password)
        expect(result.isValid).toBe(false)
        expect(result.error).toBeDefined()
      })
    })
  })

  describe('sanitizeInput', () => {
    it('should remove dangerous content', () => {
      const dangerousInput = '<script>alert("xss")</script>Hello World'
      const result = MobileInputValidator.sanitizeInput(dangerousInput)
      
      expect(result).not.toContain('<script>')
      expect(result).toContain('Hello World')
    })

    it('should respect maximum length', () => {
      const longInput = 'a'.repeat(1000)
      const result = MobileInputValidator.sanitizeInput(longInput, 100)
      
      expect(result.length).toBe(100)
    })
  })
})

describe('MobileSecurityLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    MobileSecurityLogger.clearSecurityEvents()
  })

  describe('logSecurityEvent', () => {
    it('should log security events', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      MobileSecurityLogger.logSecurityEvent('test_event', 'medium', { test: 'data' })
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should store events', async () => {
      MobileSecurityLogger.logSecurityEvent('test_event', 'low', { test: 'data' })
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const events = await MobileSecurityLogger.getSecurityEvents()
      expect(events.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('clearSecurityEvents', () => {
    it('should clear all security events', async () => {
      MobileSecurityLogger.logSecurityEvent('test_event', 'low', { test: 'data' })
      MobileSecurityLogger.clearSecurityEvents()
      
      const events = await MobileSecurityLogger.getSecurityEvents()
      expect(events).toHaveLength(0)
    })
  })
})

describe('MobileRateLimiter', () => {
  beforeEach(() => {
    MobileRateLimiter.clearLimits()
  })

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      const key = 'test-key'
      const limit = 3
      const windowMs = 60000
      
      // First 3 requests should be allowed
      for (let i = 0; i < limit; i++) {
        expect(MobileRateLimiter.checkLimit(key, limit, windowMs)).toBe(true)
      }
    })

    it('should block requests exceeding limit', () => {
      const key = 'test-key'
      const limit = 2
      const windowMs = 60000
      
      // First 2 requests should be allowed
      expect(MobileRateLimiter.checkLimit(key, limit, windowMs)).toBe(true)
      expect(MobileRateLimiter.checkLimit(key, limit, windowMs)).toBe(true)
      
      // 3rd request should be blocked
      expect(MobileRateLimiter.checkLimit(key, limit, windowMs)).toBe(false)
    })
  })

  describe('clearLimits', () => {
    it('should clear all rate limits', () => {
      const key = 'test-key'
      const limit = 1
      const windowMs = 60000
      
      // Use up the limit
      MobileRateLimiter.checkLimit(key, limit, windowMs)
      expect(MobileRateLimiter.checkLimit(key, limit, windowMs)).toBe(false)
      
      // Clear limits
      MobileRateLimiter.clearLimits()
      
      // Should be able to make requests again
      expect(MobileRateLimiter.checkLimit(key, limit, windowMs)).toBe(true)
    })
  })
})
})
})