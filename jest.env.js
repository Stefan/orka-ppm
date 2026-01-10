// Jest environment setup for globals
// This file sets up Jest globals to avoid no-undef errors

// Set up Jest globals
global.jest = require('jest')
global.describe = global.describe || jest.describe || (() => {})
global.it = global.it || jest.it || (() => {})
global.test = global.test || jest.test || (() => {})
global.expect = global.expect || jest.expect || (() => {})
global.beforeEach = global.beforeEach || jest.beforeEach || (() => {})
global.afterEach = global.afterEach || jest.afterEach || (() => {})
global.beforeAll = global.beforeAll || jest.beforeAll || (() => {})
global.afterAll = global.afterAll || jest.afterAll || (() => {})

// Mock browser APIs that might be missing in Node.js environment
if (typeof window === 'undefined') {
  global.window = {}
}

if (typeof document === 'undefined') {
  global.document = {}
}

if (typeof navigator === 'undefined') {
  global.navigator = {
    userAgent: 'node.js'
  }
}