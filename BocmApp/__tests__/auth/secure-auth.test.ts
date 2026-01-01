import { SecureAuth, SecureAPI, SecureStorage } from '@/lib/secure-auth'
import { MobileSecurity, MobileSecurityLogger, MobileRateLimiter, MobileInputValidator } from '@/lib/mobile-security'
import { Platform } from 'react-native'

// Mock dependencies
jest.mock('@/lib/mobile-security', () => ({
  MobileSecurity: {
    validateDeviceSecurity: jest.fn(),
    hashData: jest.fn(),
    setSecureItem: jest.fn(),
    getSecureItem: jest.fn(),
    removeSecureItem: jest.fn(),
    generateSecureToken: jest.fn(),
    encryptData: jest.fn(),
    decryptData: jest.fn(),
  },
  MobileSecurityLogger: {
    logSecurityEvent: jest.fn(),
    clearSecurityEvents: jest.fn(),
  },
  MobileRateLimiter: {
    checkLimit: jest.fn(),
    clearLimits: jest.fn(),
  },
  MobileInputValidator: {
    validateEmail: jest.fn(),
    validatePassword: jest.fn(),
    sanitizeInput: jest.fn((input) => input.replace(/<[^>]*>/g, '')),
  },
}))
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '15.0' },
}))

describe('SecureAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    MobileRateLimiter.clearLimits = jest.fn()
    MobileSecurityLogger.logSecurityEvent = jest.fn()
    MobileSecurityLogger.clearSecurityEvents = jest.fn()
  })

  describe('secureLogin', () => {
    it('should successfully login with valid credentials', async () => {
      MobileRateLimiter.checkLimit = jest.fn().mockReturnValue(true)
      MobileInputValidator.validateEmail = jest.fn().mockReturnValue({ isValid: true })
      MobileInputValidator.validatePassword = jest.fn().mockReturnValue({ isValid: true })
      MobileSecurity.validateDeviceSecurity = jest.fn().mockResolvedValue({ isSecure: true, warnings: [] })
      MobileSecurity.hashData = jest.fn().mockResolvedValue('hashed-password')
      MobileSecurity.setSecureItem = jest.fn().mockResolvedValue(undefined)
      
      const result = await SecureAuth.secureLogin('test@example.com', 'Password123!')
      
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject login when rate limit is exceeded', async () => {
      MobileRateLimiter.checkLimit = jest.fn().mockReturnValue(false)
      
      const result = await SecureAuth.secureLogin('test@example.com', 'Password123!')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Too many login attempts. Please try again later.')
    })

    it('should reject login with invalid email', async () => {
      MobileRateLimiter.checkLimit = jest.fn().mockReturnValue(true)
      MobileInputValidator.validateEmail = jest.fn().mockReturnValue({ 
        isValid: false, 
        error: 'Invalid email format' 
      })
      
      const result = await SecureAuth.secureLogin('invalid-email', 'Password123!')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('secureRegister', () => {
    it('should successfully register with valid data', async () => {
      MobileRateLimiter.checkLimit = jest.fn().mockReturnValue(true)
      MobileInputValidator.validateEmail = jest.fn().mockReturnValue({ isValid: true })
      MobileInputValidator.validatePassword = jest.fn().mockReturnValue({ isValid: true })
      MobileSecurity.generateSecureToken = jest.fn().mockReturnValue('secure-token')
      MobileSecurity.setSecureItem = jest.fn().mockResolvedValue(undefined)
      
      const result = await SecureAuth.secureRegister({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        role: 'client',
      })
      
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject registration when rate limit is exceeded', async () => {
      MobileRateLimiter.checkLimit = jest.fn().mockReturnValue(false)
      
      const result = await SecureAuth.secureRegister({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        role: 'client',
      })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Too many registration attempts. Please try again later.')
    })
  })

  describe('secureLogout', () => {
    it('should clear all secure storage on logout', async () => {
      MobileSecurity.removeSecureItem = jest.fn().mockResolvedValue(undefined)
      MobileRateLimiter.clearLimits = jest.fn()
      
      await SecureAuth.secureLogout()
      
      expect(MobileSecurity.removeSecureItem).toHaveBeenCalledTimes(4)
      expect(MobileRateLimiter.clearLimits).toHaveBeenCalled()
    })
  })

  describe('isDeviceSecure', () => {
    it('should return true for secure device', async () => {
      MobileSecurity.validateDeviceSecurity = jest.fn().mockResolvedValue({
        isSecure: true,
        warnings: [],
      })
      
      const result = await SecureAuth.isDeviceSecure()
      
      expect(result).toBe(true)
    })

    it('should return false for insecure device', async () => {
      MobileSecurity.validateDeviceSecurity = jest.fn().mockResolvedValue({
        isSecure: false,
        warnings: ['Device is rooted'],
      })
      
      const result = await SecureAuth.isDeviceSecure()
      
      expect(result).toBe(false)
    })
  })
})

describe('SecureAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  describe('secureRequest', () => {
    it('should make successful API request', async () => {
      MobileRateLimiter.checkLimit = jest.fn().mockReturnValue(true)
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      })
      
      const result = await SecureAPI.secureRequest('https://api.example.com/test')
      
      expect(result).toEqual({ data: 'test' })
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Platform': 'ios',
          }),
        })
      )
    })

    it('should reject request when rate limit is exceeded', async () => {
      MobileRateLimiter.checkLimit = jest.fn().mockReturnValue(false)
      
      await expect(
        SecureAPI.secureRequest('https://api.example.com/test')
      ).rejects.toThrow('API rate limit exceeded')
    })

    it('should retry on server errors', async () => {
      MobileRateLimiter.checkLimit = jest.fn().mockReturnValue(true)
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ data: 'test' }),
        })
      
      const result = await SecureAPI.secureRequest('https://api.example.com/test')
      
      expect(result).toEqual({ data: 'test' })
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})

describe('SecureStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('setItem', () => {
    it('should encrypt and store data', async () => {
      MobileSecurity.encryptData = jest.fn().mockResolvedValue('encrypted-data')
      MobileSecurity.setSecureItem = jest.fn().mockResolvedValue(undefined)
      
      await SecureStorage.setItem('test-key', { data: 'test' })
      
      expect(MobileSecurity.encryptData).toHaveBeenCalledWith(
        JSON.stringify({ data: 'test' }),
        'test-key'
      )
      expect(MobileSecurity.setSecureItem).toHaveBeenCalledWith(
        'test-key',
        'encrypted-data'
      )
    })

    it('should handle encryption errors', async () => {
      MobileSecurity.encryptData = jest.fn().mockRejectedValue(
        new Error('Encryption failed')
      )
      
      await expect(
        SecureStorage.setItem('test-key', { data: 'test' })
      ).rejects.toThrow('Failed to store data securely')
    })
  })

  describe('getItem', () => {
    it('should decrypt and retrieve data', async () => {
      MobileSecurity.getSecureItem = jest.fn().mockResolvedValue('encrypted-data')
      MobileSecurity.decryptData = jest.fn().mockResolvedValue(
        JSON.stringify({ data: 'test' })
      )
      
      const result = await SecureStorage.getItem('test-key')
      
      expect(result).toEqual({ data: 'test' })
      expect(MobileSecurity.decryptData).toHaveBeenCalledWith(
        'encrypted-data',
        'test-key'
      )
    })

    it('should return null if item does not exist', async () => {
      MobileSecurity.getSecureItem = jest.fn().mockResolvedValue(null)
      
      const result = await SecureStorage.getItem('test-key')
      
      expect(result).toBeNull()
    })
  })

  describe('removeItem', () => {
    it('should remove item from storage', async () => {
      MobileSecurity.removeSecureItem = jest.fn().mockResolvedValue(undefined)
      
      await SecureStorage.removeItem('test-key')
      
      expect(MobileSecurity.removeSecureItem).toHaveBeenCalledWith('test-key')
    })
  })

  describe('clear', () => {
    it('should clear all storage items', async () => {
      MobileSecurity.removeSecureItem = jest.fn().mockResolvedValue(undefined)
      
      await SecureStorage.clear()
      
      expect(MobileSecurity.removeSecureItem).toHaveBeenCalledTimes(4)
    })
  })
})