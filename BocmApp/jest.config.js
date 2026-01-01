module.exports = {
  preset: 'react-native',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@expo|expo|@unimodules|unimodules|sentry-expo|native-base|react-navigation|@react-navigation|@react-native-async-storage|@react-native-picker|@react-native-community|react-native-vector-icons|react-native-screens|react-native-safe-area-context|react-native-gesture-handler|react-native-reanimated|react-native-svg|lucide-react-native)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/index.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    // Specific mappings must come before the generic @/* pattern
    '^@/shared/(.*)$': '<rootDir>/app/shared/$1',
    '^@/components/(.*)$': '<rootDir>/app/shared/components/$1',
    '^@/hooks/(.*)$': '<rootDir>/app/shared/hooks/$1',
    '^@/lib/(.*)$': '<rootDir>/app/shared/lib/$1',
    '^@/types/(.*)$': '<rootDir>/app/shared/types/$1',
    '^@/utils/(.*)$': '<rootDir>/app/shared/utils/$1',
    '^@/pages/(.*)$': '<rootDir>/app/pages/$1',
    '^@/navigation/(.*)$': '<rootDir>/app/navigation/$1',
  },
  testTimeout: 10000,
  verbose: true,
  maxWorkers: 1,
}