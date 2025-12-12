// Enhanced error recovery utilities with retry mechanisms and graceful degradation
import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface TimeoutOptions {
  timeout?: number;
  timeoutMessage?: string;
}

/**
 * Retry a function with exponential backoff
 * Standard pattern for handling transient failures
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    onRetry,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        logger.error(`Max retries (${maxRetries}) exceeded`, lastError);
        throw lastError;
      }

      // Check if error is retryable
      if (!shouldRetry(lastError)) {
        logger.error('Error is not retryable', lastError);
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = exponentialBackoff
        ? retryDelay * Math.pow(2, attempt)
        : retryDelay;

      logger.warn(
        `Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`,
        lastError.message
      );

      // Call retry callback
      onRetry?.(attempt + 1, lastError);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Add timeout to a promise
 * Prevents hanging requests
 */
export function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const { timeout = 30000, timeoutMessage = 'Operation timed out' } = options;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeout)
    ),
  ]);
}

/**
 * Graceful degradation wrapper
 * Returns fallback value if operation fails
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallbackValue: T,
  onError?: (error: Error) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.warn('Operation failed, using fallback value', error);
    onError?.(error as Error);
    return fallbackValue;
  }
}

/**
 * Circuit breaker pattern
 * Prevents cascading failures by failing fast after repeated errors
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private options: {
      failureThreshold?: number;
      resetTimeout?: number;
      onStateChange?: (state: 'CLOSED' | 'OPEN' | 'HALF_OPEN') => void;
    } = {}
  ) {
    this.options.failureThreshold = options.failureThreshold ?? 5;
    this.options.resetTimeout = options.resetTimeout ?? 60000; // 1 minute
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if we should try again
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.options.resetTimeout!) {
        throw new Error('Circuit breaker is OPEN. Service temporarily unavailable.');
      }
      // Move to half-open state
      this.setState('HALF_OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state !== 'CLOSED') {
      this.setState('CLOSED');
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold!) {
      this.setState('OPEN');
    }
  }

  private setState(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN') {
    if (this.state !== state) {
      logger.log(`Circuit breaker state changed: ${this.state} -> ${state}`);
      this.state = state;
      this.options.onStateChange?.(state);
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.setState('CLOSED');
  }
}

/**
 * Check if error is a network error (retryable)
 */
export function isNetworkError(error: any): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  // Check if error has a message property
  if (!error.message || typeof error.message !== 'string') {
    return false;
  }

  const networkErrorMessages = [
    'network request failed',
    'network error',
    'connection timeout',
    'timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
  ];

  return networkErrorMessages.some((msg) =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

/**
 * Check if error is a server error (retryable)
 */
export function isServerError(error: any): boolean {
  return error.status >= 500 && error.status < 600;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  return isNetworkError(error) || isServerError(error);
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce function calls
 * Useful for preventing repeated API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function calls
 * Useful for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logger.warn('JSON parse failed, using fallback', error);
    return fallback;
  }
}

/**
 * Batch multiple operations with a delay between each
 * Prevents overwhelming the server
 */
export async function batchWithDelay<T>(
  items: T[],
  operation: (item: T) => Promise<void>,
  delayMs: number = 100
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await operation(items[i]);
    if (i < items.length - 1) {
      await sleep(delayMs);
    }
  }
}

/**
 * Parallel execution with concurrency limit
 */
export async function parallelLimit<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  limit: number = 3
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = operation(item).then((result) => {
      results.push(result);
      executing.splice(executing.indexOf(promise), 1);
    });

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

