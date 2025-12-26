import {
  withRetry,
  withTimeout,
  withFallback,
  CircuitBreaker,
  isNetworkError,
  isServerError,
  isRetryableError,
  safeJsonParse,
} from '../app/shared/lib/errorRecovery';

// Mock logger
jest.mock('../app/shared/lib/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Error Recovery Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(successFn, { maxRetries: 3 });
      
      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const retryFn = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await withRetry(retryFn, { 
        maxRetries: 3,
        retryDelay: 10,
        exponentialBackoff: false,
      });

      expect(result).toBe('success');
      expect(retryFn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries exceeded', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Permanent failure'));

      await expect(
        withRetry(failFn, { maxRetries: 2, retryDelay: 10 })
      ).rejects.toThrow('Permanent failure');

      expect(failFn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      let attempts = 0;
      const retryFn = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Retry me');
        }
        return 'success';
      });

      await withRetry(retryFn, { 
        maxRetries: 2,
        retryDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should not retry if shouldRetry returns false', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Not retryable'));
      const shouldRetry = jest.fn().mockReturnValue(false);

      await expect(
        withRetry(failFn, { maxRetries: 3, shouldRetry })
      ).rejects.toThrow('Not retryable');

      expect(failFn).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalled();
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const retryFn = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 4) {
          throw new Error('Retry with backoff');
        }
        return 'success';
      });

      const startTime = Date.now();
      await withRetry(retryFn, {
        maxRetries: 3,
        retryDelay: 100,
        exponentialBackoff: true,
      });
      const endTime = Date.now();

      // With exponential backoff: 100ms, 200ms, 400ms = 700ms minimum
      expect(endTime - startTime).toBeGreaterThanOrEqual(600);
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes before timeout', async () => {
      const quickPromise = Promise.resolve('quick');
      
      const result = await withTimeout(quickPromise, { timeout: 1000 });
      
      expect(result).toBe('quick');
    });

    it('should reject if promise takes too long', async () => {
      const slowPromise = new Promise((resolve) => setTimeout(() => resolve('slow'), 1000));
      
      await expect(
        withTimeout(slowPromise, { timeout: 100, timeoutMessage: 'Too slow!' })
      ).rejects.toThrow('Too slow!');
    });
  });

  describe('withFallback', () => {
    it('should return result on success', async () => {
      const successFn = async () => 'success';
      
      const result = await withFallback(successFn, 'fallback');
      
      expect(result).toBe('success');
    });

    it('should return fallback value on failure', async () => {
      const failFn = async () => {
        throw new Error('Failed');
      };
      
      const result = await withFallback(failFn, 'fallback');
      
      expect(result).toBe('fallback');
    });

    it('should call onError callback', async () => {
      const onError = jest.fn();
      const failFn = async () => {
        throw new Error('Failed');
      };
      
      await withFallback(failFn, 'fallback', onError);
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('CircuitBreaker', () => {
    it('should allow requests when CLOSED', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const successFn = jest.fn().mockResolvedValue('success');

      const result = await breaker.execute(successFn);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should open after failure threshold', async () => {
      const breaker = new CircuitBreaker({ 
        failureThreshold: 3,
        resetTimeout: 1000,
      });
      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // Next call should fail immediately
      await expect(
        breaker.execute(failFn)
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should reset after successful request', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));
      const successFn = jest.fn().mockResolvedValue('success');

      // Fail twice
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }

      // Succeed once
      await breaker.execute(successFn);

      // Circuit should be closed
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should call onStateChange callback', async () => {
      const onStateChange = jest.fn();
      const breaker = new CircuitBreaker({ 
        failureThreshold: 2,
        onStateChange,
      });
      const failFn = jest.fn().mockRejectedValue(new Error('Failed'));

      // Fail twice to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }

      expect(onStateChange).toHaveBeenCalledWith('OPEN');
    });
  });

  describe('Error Type Checkers', () => {
    it('should identify network errors', () => {
      expect(isNetworkError(new Error('Network request failed'))).toBe(true);
      expect(isNetworkError(new Error('Connection timeout'))).toBe(true);
      expect(isNetworkError(new Error('ETIMEDOUT'))).toBe(true);
      expect(isNetworkError(new Error('Something else'))).toBe(false);
    });

    it('should identify server errors', () => {
      expect(isServerError({ status: 500 })).toBe(true);
      expect(isServerError({ status: 503 })).toBe(true);
      expect(isServerError({ status: 404 })).toBe(false);
      expect(isServerError({ status: 200 })).toBe(false);
    });

    it('should identify retryable errors', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 400 })).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should return fallback for invalid JSON', () => {
      const result = safeJsonParse('invalid json', { fallback: true });
      expect(result).toEqual({ fallback: true });
    });
  });
});

