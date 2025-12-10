// React hooks for error recovery and graceful degradation
import { useState, useCallback, useRef, useEffect } from 'react';
import { withRetry, withTimeout, withFallback, RetryOptions, TimeoutOptions } from '../lib/errorRecovery';
import { logger } from '../lib/logger';

export interface UseAsyncOptions<T> extends RetryOptions, TimeoutOptions {
  fallbackValue?: T;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
}

/**
 * Hook for handling async operations with retry and error recovery
 */
export function useAsyncWithRetry<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncOptions<T> = {}
) {
  const [data, setData] = useState<T | undefined>(options.fallbackValue);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Apply timeout if specified
      let promise = asyncFn();
      if (options.timeout) {
        promise = withTimeout(promise, {
          timeout: options.timeout,
          timeoutMessage: options.timeoutMessage,
        });
      }

      // Apply retry logic
      const result = await withRetry(() => promise, {
        maxRetries: options.maxRetries,
        retryDelay: options.retryDelay,
        exponentialBackoff: options.exponentialBackoff,
        shouldRetry: options.shouldRetry,
        onRetry: (attempt, err) => {
          setRetryCount(attempt);
          options.onRetry?.(attempt, err);
        },
      });

      setData(result);
      options.onSuccess?.(result);
      setRetryCount(0);
    } catch (err) {
      const error = err as Error;
      setError(error);
      options.onError?.(error);

      // Use fallback value if provided
      if (options.fallbackValue !== undefined) {
        setData(options.fallbackValue);
      }
    } finally {
      setLoading(false);
    }
  }, [asyncFn, options]);

  return {
    data,
    error,
    loading,
    retryCount,
    execute,
    reset: () => {
      setData(options.fallbackValue);
      setError(null);
      setLoading(false);
      setRetryCount(0);
    },
  };
}

/**
 * Hook for safe async operations with graceful degradation
 */
export function useSafeAsync<T>(
  asyncFn: () => Promise<T>,
  fallbackValue: T
) {
  const [data, setData] = useState<T>(fallbackValue);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await withFallback(
      asyncFn,
      fallbackValue,
      (err) => {
        setError(err);
        logger.warn('Async operation failed, using fallback', err);
      }
    );

    setData(result);
    setLoading(false);
  }, [asyncFn, fallbackValue]);

  return {
    data,
    error,
    loading,
    execute,
  };
}

/**
 * Hook for managing loading states with automatic error recovery
 */
export function useLoadingState() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const wrapAsync = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      if (!mountedRef.current) return null;

      setLoading(true);
      setError(null);

      try {
        const result = await fn();
        if (mountedRef.current) {
          setLoading(false);
        }
        return result;
      } catch (err) {
        const error = err as Error;
        if (mountedRef.current) {
          setError(error);
          setLoading(false);
        }
        logger.error('Async operation failed', error);
        return null;
      }
    },
    []
  );

  return {
    loading,
    error,
    wrapAsync,
    setLoading,
    setError,
    clearError: () => setError(null),
  };
}

/**
 * Hook for network operations with automatic retry
 */
export function useNetworkRequest<T>(options: UseAsyncOptions<T> = {}) {
  return useAsyncWithRetry<T>(
    async () => {
      throw new Error('Not implemented - pass your fetch function');
    },
    {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      timeout: 30000,
      shouldRetry: (error) => {
        // Retry on network errors or 5xx server errors
        const isNetworkError = error.message.toLowerCase().includes('network');
        const isServerError = error.message.includes('5');
        return isNetworkError || isServerError;
      },
      ...options,
    }
  );
}

/**
 * Hook for form submission with error handling
 */
export function useFormSubmit<T>(
  submitFn: (data: any) => Promise<T>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = useCallback(
    async (formData: any) => {
      setSubmitting(true);
      setError(null);
      setSuccess(false);

      try {
        const result = await submitFn(formData);
        setSuccess(true);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [submitFn, options]
  );

  return {
    submit,
    submitting,
    error,
    success,
    reset: () => {
      setSubmitting(false);
      setError(null);
      setSuccess(false);
    },
  };
}

/**
 * Hook for optimistic updates with rollback
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T) => Promise<T>
) {
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [updating, setUpdating] = useState(false);
  const previousDataRef = useRef<T>(initialData);

  const update = useCallback(
    async (optimisticData: T) => {
      // Store previous data for rollback
      previousDataRef.current = data;

      // Optimistically update
      setData(optimisticData);
      setUpdating(true);
      setError(null);

      try {
        // Perform actual update
        const result = await updateFn(optimisticData);
        setData(result);
      } catch (err) {
        const error = err as Error;
        // Rollback on error
        setData(previousDataRef.current);
        setError(error);
        logger.error('Optimistic update failed, rolling back', error);
      } finally {
        setUpdating(false);
      }
    },
    [data, updateFn]
  );

  return {
    data,
    error,
    updating,
    update,
  };
}

/**
 * Hook for data fetching with cache
 */
export function useCachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    cacheTime?: number; // milliseconds
    staleTime?: number; // milliseconds
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const { cacheTime = 5 * 60 * 1000, staleTime = 60 * 1000 } = options;

  const fetch = useCallback(async (force = false) => {
    // Check cache
    const cached = cacheRef.current.get(key);
    const now = Date.now();

    if (!force && cached && now - cached.timestamp < cacheTime) {
      setData(cached.data);
      setLastFetched(cached.timestamp);
      
      // If stale, fetch in background
      if (now - cached.timestamp > staleTime) {
        fetchInBackground();
      }
      
      return;
    }

    // Fetch fresh data
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      const timestamp = Date.now();

      setData(result);
      setLastFetched(timestamp);

      // Update cache
      cacheRef.current.set(key, { data: result, timestamp });
    } catch (err) {
      const error = err as Error;
      setError(error);
      logger.error('Cached fetch failed', error);
    } finally {
      setLoading(false);
    }
  }, [key, fetchFn, cacheTime, staleTime]);

  const fetchInBackground = useCallback(async () => {
    try {
      const result = await fetchFn();
      const timestamp = Date.now();
      setData(result);
      setLastFetched(timestamp);
      cacheRef.current.set(key, { data: result, timestamp });
    } catch (err) {
      logger.warn('Background fetch failed', err);
    }
  }, [key, fetchFn]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    data,
    error,
    loading,
    lastFetched,
    refetch: () => fetch(true),
    invalidate: () => cacheRef.current.delete(key),
  };
}

