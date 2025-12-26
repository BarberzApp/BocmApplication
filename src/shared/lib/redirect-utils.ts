// Utility functions for handling redirect URLs during login
import { logger } from './logger'

/**
 * Store a URL to redirect to after successful login
 * @param url The URL to redirect to after login
 */
export const storeRedirectUrl = (url: string) => {
  try {
    sessionStorage.setItem('redirectAfterLogin', url)
  } catch (error) {
    logger.error('Failed to store redirect URL', error)
  }
}

/**
 * Get and remove the stored redirect URL
 * @returns The stored redirect URL or null if none exists
 */
export const getAndClearRedirectUrl = (): string | null => {
  try {
    const url = sessionStorage.getItem('redirectAfterLogin')
    if (url) {
      sessionStorage.removeItem('redirectAfterLogin')
    }
    return url
  } catch (error) {
    logger.error('Failed to get redirect URL', error)
    return null
  }
}

/**
 * Check if there's a stored redirect URL
 * @returns True if a redirect URL is stored
 */
export const hasStoredRedirectUrl = (): boolean => {
  try {
    return !!sessionStorage.getItem('redirectAfterLogin')
  } catch (error) {
    logger.error('Failed to check redirect URL', error)
    return false
  }
}

/**
 * Clear any stored redirect URL
 */
export const clearRedirectUrl = () => {
  try {
    sessionStorage.removeItem('redirectAfterLogin')
  } catch (error) {
    logger.error('Failed to clear redirect URL', error)
  }
}

/**
 * Store the current page URL as the redirect target
 * This is useful for protecting routes that require authentication
 */
export const storeCurrentPageAsRedirect = () => {
  try {
    const currentUrl = window.location.pathname + window.location.search
    // Don't store login or register pages as redirect targets
    if (!currentUrl.includes('/login') && !currentUrl.includes('/register')) {
      storeRedirectUrl(currentUrl)
    }
  } catch (error) {
    logger.error('Failed to store current page as redirect', error)
  }
} 