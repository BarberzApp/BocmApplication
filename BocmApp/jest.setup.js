// In-memory storage for mocks
const mockStorage = new Map()

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStorage.get(key) || null)),
  setItem: jest.fn((key, value) => {
    mockStorage.set(key, value)
    return Promise.resolve()
  }),
  removeItem: jest.fn((key) => {
    mockStorage.delete(key)
    return Promise.resolve()
  }),
  clear: jest.fn(() => {
    mockStorage.clear()
    return Promise.resolve()
  }),
}))

// Mock Expo SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key) => Promise.resolve(mockStorage.get(key) || null)),
  setItemAsync: jest.fn((key, value) => {
    mockStorage.set(key, value)
    return Promise.resolve()
  }),
  deleteItemAsync: jest.fn((key) => {
    mockStorage.delete(key)
    return Promise.resolve()
  }),
}))

// Mock Expo Crypto
jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((length) => {
    // Return a Uint8Array with predictable values that convert to hex
    // For 'mock-token' in hex (32 chars = 16 bytes): 6d6f636b2d746f6b656e
    // But we'll use simpler pattern: create bytes that produce predictable hex
    const bytes = new Uint8Array(length || 16);
    // Fill with pattern: 0x6d, 0x6f, 0x63, 0x6b, etc. (ASCII for "mock-token")
    const pattern = new Uint8Array([0x6d, 0x6f, 0x63, 0x6b, 0x2d, 0x74, 0x6f, 0x6b, 0x65, 0x6e, 0x6d, 0x6f, 0x63, 0x6b, 0x2d, 0x74]);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = pattern[i % pattern.length];
    }
    return bytes;
  }),
  digestStringAsync: jest.fn(() => Promise.resolve('mock-hash')),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  CryptoEncoding: {
    HEX: 'hex',
  },
}))

// Mock React Native Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  Version: '15.0',
  select: jest.fn((obj) => obj.ios || obj.default),
}))

// Mock lucide-react-native to avoid SVG/Platform issues in tests
jest.mock('lucide-react-native', () => {
  const createMockIcon = (name: string) => name;
  return {
    MailCheck: 'MailCheck',
    RefreshCw: 'RefreshCw',
    LogIn: 'LogIn',
    ArrowLeft: 'ArrowLeft',
    Scissors: 'Scissors',
    Eye: 'Eye',
    EyeOff: 'EyeOff',
    // Add any other icons as needed
  };
})

// Mock React Native Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}))

// Mock Supabase
jest.mock('./app/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => Promise.resolve({ data: null, error: null })),
      delete: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}))

// Global test utilities
global.__DEV__ = true

// Suppress console warnings in tests
const originalWarn = console.warn
const originalError = console.error

beforeAll(() => {
  console.warn = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  console.warn = originalWarn
  console.error = originalError
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
  mockStorage.clear()
})