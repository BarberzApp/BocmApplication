describe('Logger', () => {
  let logger: any
  let mockConsoleLog: jest.SpyInstance
  let mockConsoleError: jest.SpyInstance
  let mockConsoleWarn: jest.SpyInstance

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation()
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation()
    
    jest.clearAllMocks()
    jest.resetModules()
    ;(global as any).__DEV__ = true
    process.env.NODE_ENV = 'development'
    
    delete require.cache[require.resolve('../app/shared/lib/logger')]
    logger = require('../app/shared/lib/logger').logger
  })

  afterEach(() => {
    mockConsoleLog.mockRestore()
    mockConsoleError.mockRestore()
    mockConsoleWarn.mockRestore()
  })

  describe('in development mode', () => {
    it('should log messages', () => {
      logger.log('test message')
      expect(mockConsoleLog).toHaveBeenCalledWith('test message')
    })

    it('should log errors', () => {
      logger.error('error message')
      expect(mockConsoleError).toHaveBeenCalledWith('error message')
    })

    it('should log warnings', () => {
      logger.warn('warning message')
      expect(mockConsoleWarn).toHaveBeenCalledWith('warning message')
    })

    it('should handle multiple arguments', () => {
      logger.log('arg1', 'arg2')
      expect(mockConsoleLog).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })

  describe('in production mode', () => {
    beforeEach(() => {
      jest.resetModules()
      ;(global as any).__DEV__ = false
      process.env.NODE_ENV = 'production'
      delete require.cache[require.resolve('../app/shared/lib/logger')]
      logger = require('../app/shared/lib/logger').logger
    })

    it('should not log regular messages', () => {
      logger.log('test message')
      expect(mockConsoleLog).not.toHaveBeenCalled()
    })

    it('should still log errors', () => {
      logger.error('error message')
      expect(mockConsoleError).toHaveBeenCalledWith('error message')
    })

    it('should not log warnings', () => {
      logger.warn('warning message')
      expect(mockConsoleWarn).not.toHaveBeenCalled()
    })
  })
})

