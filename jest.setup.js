import '@testing-library/jest-dom'

// Import custom testing utilities
import { toMeetTouchTargetRequirements, toHaveResponsiveLayout } from './__tests__/utils/responsive-testing'
import { toBeAccessible } from './__tests__/utils/accessibility-testing'

// Extend Jest matchers
expect.extend({
  toMeetTouchTargetRequirements,
  toHaveResponsiveLayout,
  toBeAccessible
})

// Add polyfills for Node.js environment
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder
}

if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = require('stream/web').ReadableStream
}

// Mock IndexedDB for testing environment
if (typeof indexedDB === 'undefined') {
  global.indexedDB = {
    open: jest.fn(),
    deleteDatabase: jest.fn(),
  }
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ''
  },
}))

// Mock Supabase
jest.mock('./app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    clearSession: jest.fn(),
  }),
}))

// Mock service worker for PWA tests
Object.defineProperty(window, 'navigator', {
  value: {
    serviceWorker: {
      register: jest.fn(() => Promise.resolve()),
      ready: Promise.resolve({
        unregister: jest.fn(() => Promise.resolve()),
      }),
    },
  },
  writable: true,
})