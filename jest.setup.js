import '@testing-library/jest-dom'

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