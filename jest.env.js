// Jest environment setup for globals
// This file sets up Jest globals to avoid no-undef errors

// Polyfill MessagePort/MessageChannel for undici (required when tests import undici)
if (typeof global.MessagePort === 'undefined') {
  const noop = () => {}
  global.MessagePort = class MessagePort {
    addEventListener = noop
    removeEventListener = noop
    dispatchEvent = () => true
    start() {}
    close() {}
    postMessage() {}
    ref() {}
    unref() {}
  }
}
if (typeof global.MessageChannel === 'undefined') {
  global.MessageChannel = class MessageChannel {
    constructor() {
      this.port1 = { addEventListener: () => {}, removeEventListener: () => {}, start: () => {}, close: () => {}, postMessage: () => {}, ref: () => {}, unref: () => {}, dispatchEvent: () => true }
      this.port2 = { addEventListener: () => {}, removeEventListener: () => {}, start: () => {}, close: () => {}, postMessage: () => {}, ref: () => {}, unref: () => {}, dispatchEvent: () => true }
    }
  }
}

// Polyfill Request/Response/Headers BEFORE any Next.js or route code loads (fixes "Request is not defined")
function polyfillRequestResponse() {
  if (typeof global.Request !== 'undefined') return
  try {
    const { Request, Response, Headers } = require('undici')
    global.Request = globalThis.Request = Request
    global.Response = globalThis.Response = Response
    global.Headers = globalThis.Headers = Headers
  } catch {
    if (typeof globalThis.Request !== 'undefined') {
      global.Request = globalThis.Request
      global.Response = globalThis.Response
      global.Headers = globalThis.Headers
    }
  }
}
polyfillRequestResponse()

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