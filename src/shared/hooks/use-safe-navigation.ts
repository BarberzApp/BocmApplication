import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';
import { logger } from '@/shared/lib/logger';

export const useSafeNavigation = () => {
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  const safePush = useCallback((url: string) => {
    if (isNavigatingRef.current) {
      logger.debug('Navigation already in progress, skipping', { url });
      return;
    }

    isNavigatingRef.current = true;
    logger.debug('Navigating to', { url });

    try {
      router.push(url);
      
      // Reset navigation state after a delay
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 1000);
    } catch (error) {
      logger.error('Navigation error', error);
      isNavigatingRef.current = false;
      
      // Fallback to window.location
      window.location.href = url;
    }
  }, [router]);

  const safeReplace = useCallback((url: string) => {
    if (isNavigatingRef.current) {
      logger.debug('Navigation already in progress, skipping', { url });
      return;
    }

    isNavigatingRef.current = true;
    logger.debug('Replacing with', { url });

    try {
      router.replace(url);
      
      // Reset navigation state after a delay
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 1000);
    } catch (error) {
      logger.error('Navigation error', error);
      isNavigatingRef.current = false;
      
      // Fallback to window.location
      window.location.replace(url);
    }
  }, [router]);

  const isNavigating = isNavigatingRef.current;

  return {
    push: safePush,
    replace: safeReplace,
    back: router.back,
    forward: router.forward,
    refresh: router.refresh,
    isNavigating
  };
}; 