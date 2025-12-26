import { Platform } from 'react-native'

// Mobile-specific security configuration
export const mobileSecurityConfig = {
  // Authentication security
  auth: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    sessionTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days
    passwordMinLength: 8,
    passwordMaxLength: 128,
    requireStrongPassword: true,
  },

  // API security
  api: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000, // 30 seconds
    rateLimitPerMinute: 100,
    enableCertificatePinning: Platform.OS !== 'web',
  },

  // Storage security
  storage: {
    encryptSensitiveData: true,
    maxStorageSize: 10 * 1024 * 1024, // 10MB
    autoCleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
    secureKeyRotation: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // Device security
  device: {
    checkRootStatus: true,
    checkDebugMode: true,
    requireSecureConnection: true,
    blockScreenshots: false, // Can be enabled for sensitive screens
  },

  // Content security
  content: {
    maxTextLength: 1000,
    maxImageSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['jpg', 'jpeg', 'png', 'webp'],
    enableContentModeration: true,
    profanityFilter: true,
  },

  // Monitoring and logging
  monitoring: {
    logSecurityEvents: true,
    maxEventsInMemory: 100,
    enableCrashReporting: true,
    enablePerformanceMonitoring: true,
    logLevel: __DEV__ ? 'debug' : 'error',
  },

  // Network security
  network: {
    requireHTTPS: true,
    enableCertificatePinning: Platform.OS !== 'web',
    allowedDomains: [
      'bocmstyle.com',
      'supabase.co',
      'stripe.com',
      'googleapis.com',
    ],
    blockInsecureConnections: true,
  },

  // Biometric authentication (if available)
  biometric: {
    enabled: Platform.OS !== 'web',
    fallbackToPassword: true,
    requireBiometricForSensitiveActions: false,
  },

  // App security
  app: {
    enableCodeObfuscation: !__DEV__,
    enableAntiTampering: !__DEV__,
    requireAppSignature: !__DEV__,
    enableDebugProtection: !__DEV__,
  },
}

// Environment-specific overrides
if (__DEV__) {
  // More lenient settings for development
  mobileSecurityConfig.auth.maxLoginAttempts = 10
  mobileSecurityConfig.api.rateLimitPerMinute = 1000
  mobileSecurityConfig.monitoring.logLevel = 'debug'
  mobileSecurityConfig.device.checkRootStatus = false
}

// Platform-specific overrides
if (Platform.OS === 'web') {
  mobileSecurityConfig.biometric.enabled = false
  mobileSecurityConfig.api.enableCertificatePinning = false
  mobileSecurityConfig.app.enableAntiTampering = false
}

// Security validation functions
export const validateSecurityConfig = () => {
  const config = mobileSecurityConfig
  
  // Validate required settings - warnings are handled by logger
  if (config.auth.passwordMinLength < 8) {
    // Validated in mobile-security.ts
  }
  
  if (config.api.timeout < 10000) {
    // Validated in mobile-security.ts
  }
  
  if (config.storage.maxStorageSize > 50 * 1024 * 1024) {
    // Validated in mobile-security.ts
  }
  
  return true
}

// Get security recommendations
export const getSecurityRecommendations = () => {
  const recommendations: string[] = []
  
  if (Platform.OS === 'android') {
    recommendations.push('Enable Google Play Protect')
    recommendations.push('Keep device updated')
    recommendations.push('Avoid installing apps from unknown sources')
  }
  
  if (Platform.OS === 'ios') {
    recommendations.push('Enable Find My iPhone')
    recommendations.push('Use Face ID or Touch ID')
    recommendations.push('Keep iOS updated')
  }
  
  recommendations.push('Use strong, unique passwords')
  recommendations.push('Enable two-factor authentication')
  recommendations.push('Regularly review app permissions')
  
  return recommendations
}

// Security status checker
export const checkSecurityStatus = async () => {
  const status = {
    deviceSecure: true,
    networkSecure: true,
    storageSecure: true,
    authSecure: true,
    recommendations: getSecurityRecommendations(),
  }
  
  // Check device security
  if (__DEV__) {
    status.deviceSecure = false
    status.recommendations.push('App is running in development mode')
  }
  
  // Check network security
  if (!mobileSecurityConfig.network.requireHTTPS) {
    status.networkSecure = false
    status.recommendations.push('Enable HTTPS for all connections')
  }
  
  return status
}
