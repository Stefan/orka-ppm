/**
 * Property-Based Tests for Offline Functionality
 * Feature: mobile-first-ui-enhancements, Property 14: Offline Functionality
 * Validates: Requirements 5.2, 5.4
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Import the types we need
interface OfflineData {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  retryCount: number;
  type: 'form' | 'api' | 'sync';
  metadata?: Record<string, any>;
}

// We'll import the singleton but reset it for each test
let offlineStorage: any;

// Mock IndexedDB for testing
const mockIndexedDB = {
  databases: new Map(),
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

// Mock IDBDatabase
class MockIDBDatabase {
  name: string;
  version: number;
  objectStoreNames: DOMStringList;
  stores: Map<string, MockIDBObjectStore> = new Map();

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
    // Create a mock DOMStringList with contains method
    this.objectStoreNames = {
      length: 0,
      item: (index: number) => null,
      contains: (name: string) => Array.from(this.stores.keys()).includes(name)
    } as DOMStringList;
  }

  transaction(storeNames: string[], mode: IDBTransactionMode = 'readonly') {
    return new MockIDBTransaction(this, storeNames, mode);
  }

  createObjectStore(name: string, options?: IDBObjectStoreParameters) {
    const store = new MockIDBObjectStore(name, options);
    this.stores.set(name, store);
    // Update the mock DOMStringList
    const storeNames = Array.from(this.stores.keys());
    this.objectStoreNames = {
      length: storeNames.length,
      item: (index: number) => storeNames[index] || null,
      contains: (storeName: string) => storeNames.includes(storeName)
    } as DOMStringList;
    return store;
  }

  close() {
    // Mock implementation
  }
}

// Mock IDBObjectStore
class MockIDBObjectStore {
  name: string;
  keyPath: string | string[] | null;
  data: Map<any, any> = new Map();
  indices: Map<string, MockIDBIndex> = new Map();

  constructor(name: string, options?: IDBObjectStoreParameters) {
    this.name = name;
    this.keyPath = options?.keyPath || null;
  }

  add(value: any, key?: any) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const actualKey = key || (this.keyPath ? value[this.keyPath as string] : Math.random());
      if (this.data.has(actualKey)) {
        request.error = new Error('Key already exists');
        if (request.onerror) {
          const errorEvent = new MockEvent('error', { result: null, error: request.error });
          request.onerror(errorEvent);
        }
      } else {
        this.data.set(actualKey, value);
        request.result = actualKey;
        if (request.onsuccess) {
          const successEvent = new MockEvent('success', { result: actualKey });
          request.onsuccess(successEvent);
        }
      }
    }, 0);
    return request;
  }

  put(value: any, key?: any) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const actualKey = key || (this.keyPath ? value[this.keyPath as string] : Math.random());
      this.data.set(actualKey, value);
      request.result = actualKey;
      if (request.onsuccess) {
        const successEvent = new MockEvent('success', { result: actualKey });
        request.onsuccess(successEvent);
      }
    }, 0);
    return request;
  }

  get(key: any) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.result = this.data.get(key) || undefined;
      if (request.onsuccess) {
        const successEvent = new MockEvent('success', { result: request.result });
        request.onsuccess(successEvent);
      }
    }, 0);
    return request;
  }

  getAll() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.result = Array.from(this.data.values());
      if (request.onsuccess) {
        const successEvent = new MockEvent('success', { result: request.result });
        request.onsuccess(successEvent);
      }
    }, 0);
    return request;
  }

  delete(key: any) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this.data.delete(key);
      if (request.onsuccess) {
        const successEvent = new MockEvent('success', { result: undefined });
        request.onsuccess(successEvent);
      }
    }, 0);
    return request;
  }

  clear() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this.data.clear();
      if (request.onsuccess) {
        const successEvent = new MockEvent('success', { result: undefined });
        request.onsuccess(successEvent);
      }
    }, 0);
    return request;
  }

  createIndex(name: string, keyPath: string | string[], options?: IDBIndexParameters) {
    const index = new MockIDBIndex(name, keyPath, options, this);
    this.indices.set(name, index);
    return index;
  }

  index(name: string) {
    return this.indices.get(name)!;
  }
}

// Mock IDBIndex
class MockIDBIndex {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  objectStore: MockIDBObjectStore;

  constructor(name: string, keyPath: string | string[], options?: IDBIndexParameters, objectStore?: MockIDBObjectStore) {
    this.name = name;
    this.keyPath = keyPath;
    this.unique = options?.unique || false;
    this.objectStore = objectStore!;
  }

  get(key: any) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      // Find the first item that matches the key for this index
      let result = undefined;
      for (const [itemKey, value] of this.objectStore.data) {
        const indexValue = typeof this.keyPath === 'string' ? value[this.keyPath] : value;
        if (indexValue === key) {
          result = value;
          break;
        }
      }
      request.result = result;
      if (request.onsuccess) {
        const successEvent = new MockEvent('success', { result: request.result });
        request.onsuccess(successEvent);
      }
    }, 0);
    return request;
  }

  openCursor(range?: IDBKeyRange) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      // For simplicity, return null cursor (no items to iterate)
      request.result = null;
      if (request.onsuccess) {
        const successEvent = new MockEvent('success', { result: null });
        request.onsuccess(successEvent);
      }
    }, 0);
    return request;
  }
}

// Mock IDBTransaction
class MockIDBTransaction {
  db: MockIDBDatabase;
  mode: IDBTransactionMode;
  storeNames: string[];

  constructor(db: MockIDBDatabase, storeNames: string[], mode: IDBTransactionMode) {
    this.db = db;
    this.storeNames = storeNames;
    this.mode = mode;
  }

  objectStore(name: string) {
    return this.db.stores.get(name)!;
  }
}

// Mock IDBRequest
class MockIDBRequest {
  result: any;
  error: any;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
}

// Mock IDBOpenDBRequest
class MockIDBOpenDBRequest extends MockIDBRequest {
  onupgradeneeded: ((event: Event) => void) | null = null;
}

// Custom event class that allows target modification
class MockEvent extends Event {
  private _target: any;
  
  constructor(type: string, target?: any) {
    super(type);
    this._target = target;
  }
  
  get target() {
    return this._target;
  }
  
  set target(value: any) {
    this._target = value;
  }
}

// Mock cursor for IndexedDB operations
class MockIDBCursor {
  value: any;
  key: any;
  
  constructor(value: any, key: any) {
    this.value = value;
    this.key = key;
  }
  
  delete() {
    // Mock implementation - would delete the current record
    return new MockIDBRequest();
  }
  
  continue() {
    // Mock implementation - would move to next record
  }
}

// Global storage for mock databases to ensure isolation
const mockDatabases = new Map<string, MockIDBDatabase>();

// Setup global mocks
beforeEach(async () => {
  // Clear all mock databases completely
  mockDatabases.clear();
  
  // Mock IndexedDB
  (global as any).indexedDB = {
    open: (name: string, version: number) => {
      const request = new MockIDBOpenDBRequest();
      setTimeout(() => {
        // Always create a fresh database for each test
        const db = new MockIDBDatabase(name, version);
        mockDatabases.set(name, db);
        
        // Trigger upgrade if needed
        if (request.onupgradeneeded) {
          const event = new MockEvent('upgradeneeded', { result: db });
          request.onupgradeneeded(event);
        }
        
        request.result = db;
        if (request.onsuccess) {
          const successEvent = new MockEvent('success', { result: db });
          request.onsuccess(successEvent);
        }
      }, 0);
      return request;
    },
    deleteDatabase: jest.fn()
  };

  // Mock IDBKeyRange
  (global as any).IDBKeyRange = {
    only: (value: any) => ({ only: value })
  };

  // Clear the module cache to get a fresh instance
  jest.resetModules();
  
  // Import the offline storage singleton fresh
  const { offlineStorage: importedOfflineStorage } = await import('@/lib/offline-storage');
  offlineStorage = importedOfflineStorage;
  
  // Reset the database connection
  (offlineStorage as any).db = null;
});

afterEach(async () => {
  // Clean up after each test
  try {
    // Clear all mock databases completely
    mockDatabases.clear();
    
    // Try to clear the offline storage if it exists
    if (offlineStorage && typeof offlineStorage.clearAllData === 'function') {
      await offlineStorage.clearAllData();
    }
    
    // Reset the database connection
    if (offlineStorage) {
      (offlineStorage as any).db = null;
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}, 10000);

describe('Offline Functionality Property Tests', () => {
  /**
   * Property 14: Offline Functionality
   * For any cached content or queued form submission, the system should function correctly when offline and sync when online
   * Validates: Requirements 5.2, 5.4
   */

  test('Property 14.1: Queued offline data should be retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          url: fc.webUrl(),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          headers: fc.dictionary(fc.string(), fc.string()),
          body: fc.string(),
          type: fc.constantFrom('form', 'api', 'sync'),
          metadata: fc.dictionary(fc.string(), fc.anything())
        }),
        async (offlineDataInput) => {
          // Queue the offline data
          const id = await offlineStorage.queueOfflineData(offlineDataInput);
          
          // Retrieve all offline data
          const retrievedData = await offlineStorage.getOfflineData();
          
          // Find our queued item
          const queuedItem = retrievedData.find(item => item.id === id);
          
          // Verify the item exists and has correct properties
          expect(queuedItem).toBeDefined();
          expect(queuedItem!.url).toBe(offlineDataInput.url);
          expect(queuedItem!.method).toBe(offlineDataInput.method);
          expect(queuedItem!.type).toBe(offlineDataInput.type);
          expect(queuedItem!.retryCount).toBe(0);
          expect(typeof queuedItem!.timestamp).toBe('number');
          expect(queuedItem!.timestamp).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  }, 10000);

  test('Property 14.2: Cached data should persist and be retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.string({ minLength: 1 }),
          data: fc.anything(),
          expiresIn: fc.option(fc.integer({ min: 1000, max: 86400000 })) // 1 second to 1 day
        }),
        async ({ key, data, expiresIn }) => {
          // Cache the data
          await offlineStorage.cacheData(key, data, expiresIn);
          
          // Retrieve the cached data
          const retrievedData = await offlineStorage.getCachedData(key);
          
          // Verify the data matches
          expect(retrievedData).toEqual(data);
        }
      ),
      { numRuns: 50 }
    );
  }, 10000);

  test('Property 14.3: Offline data removal should work correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            url: fc.webUrl(),
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            headers: fc.dictionary(fc.string(), fc.string()),
            body: fc.string(),
            type: fc.constantFrom('form', 'api', 'sync')
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (offlineDataArray) => {
          // Ensure we start with a clean slate
          await offlineStorage.clearAllData();
          
          // Queue multiple items
          const ids = await Promise.all(
            offlineDataArray.map(data => offlineStorage.queueOfflineData(data))
          );
          
          // Verify all items were queued initially
          const initialData = await offlineStorage.getOfflineData();
          expect(initialData.length).toBe(offlineDataArray.length);
          
          // Remove a random item
          const randomIndex = Math.floor(Math.random() * ids.length);
          const idToRemove = ids[randomIndex];
          await offlineStorage.removeOfflineData(idToRemove);
          
          // Verify the item is removed
          const remainingData = await offlineStorage.getOfflineData();
          const removedItem = remainingData.find(item => item.id === idToRemove);
          
          expect(removedItem).toBeUndefined();
          expect(remainingData.length).toBe(offlineDataArray.length - 1);
        }
      ),
      { numRuns: 30 }
    );
  }, 10000);

  test('Property 14.4: Retry count should increment correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          url: fc.webUrl(),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          headers: fc.dictionary(fc.string(), fc.string()),
          body: fc.string(),
          type: fc.constantFrom('form', 'api', 'sync')
        }),
        fc.integer({ min: 1, max: 5 }),
        async (offlineDataInput, retryCount) => {
          // Queue the offline data
          const id = await offlineStorage.queueOfflineData(offlineDataInput);
          
          // Update retry count multiple times
          for (let i = 0; i < retryCount; i++) {
            await offlineStorage.updateRetryCount(id);
          }
          
          // Retrieve and verify retry count
          const retrievedData = await offlineStorage.getOfflineData();
          const item = retrievedData.find(data => data.id === id);
          
          expect(item).toBeDefined();
          expect(item!.retryCount).toBe(retryCount);
        }
      ),
      { numRuns: 30 }
    );
  }, 10000);

  test('Property 14.5: User preferences should persist correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 50 }), 
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.float({ min: -1e10, max: 1e10 }), // Limit float range to avoid precision issues
            fc.boolean(),
            fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean()), { maxLength: 10 }),
            fc.record({
              name: fc.string(),
              value: fc.oneof(fc.string(), fc.integer(), fc.boolean())
            })
          )
        ),
        async (preferences) => {
          // Ensure we start with a clean slate
          await offlineStorage.clearAllData();
          
          // Filter out problematic keys and values that can't be serialized properly
          const cleanPreferences: Record<string, any> = {};
          for (const [key, value] of Object.entries(preferences)) {
            // Skip keys that might cause issues
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
              continue;
            }
            
            // Skip values that can't be properly serialized
            if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
              continue;
            }
            
            // Handle very large numbers that might lose precision
            if (typeof value === 'number' && (Math.abs(value) > Number.MAX_SAFE_INTEGER || !Number.isFinite(value))) {
              continue;
            }
            
            cleanPreferences[key] = value;
          }
          
          // Skip test if no valid preferences
          if (Object.keys(cleanPreferences).length === 0) {
            return;
          }
          
          // Store multiple preferences
          const keys = Object.keys(cleanPreferences);
          await Promise.all(
            keys.map(key => offlineStorage.storePreference(key, cleanPreferences[key]))
          );
          
          // Retrieve and verify all preferences
          const retrievedPreferences = await Promise.all(
            keys.map(async key => ({
              key,
              value: await offlineStorage.getPreference(key)
            }))
          );
          
          for (const { key, value } of retrievedPreferences) {
            expect(value).toEqual(cleanPreferences[key]);
          }
        }
      ),
      { numRuns: 30 }
    );
  }, 10000);

  test('Property 14.6: Cache expiration should work correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.string({ minLength: 1 }),
          data: fc.anything(),
          expiresIn: fc.integer({ min: 1, max: 100 }) // Very short expiration for testing
        }),
        async ({ key, data, expiresIn }) => {
          // Cache data with short expiration
          await offlineStorage.cacheData(key, data, expiresIn);
          
          // Wait for expiration
          await new Promise(resolve => setTimeout(resolve, expiresIn + 10));
          
          // Try to retrieve expired data
          const retrievedData = await offlineStorage.getCachedData(key);
          
          // Should return null for expired data
          expect(retrievedData).toBeNull();
        }
      ),
      { numRuns: 20, timeout: 5000 }
    );
  }, 15000);

  test('Property 14.7: Multiple cache operations should maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 10 }),
            data: fc.anything()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (cacheOperations) => {
          // Ensure we start with a clean slate
          await offlineStorage.clearAllData();
          
          // Perform all cache operations
          await Promise.all(
            cacheOperations.map(({ key, data }) => 
              offlineStorage.cacheData(key, data)
            )
          );
          
          // Create a map of expected final values (last write wins)
          const expectedValues = new Map();
          for (const { key, data } of cacheOperations) {
            expectedValues.set(key, data);
          }
          
          // Verify all cached values
          for (const [key, expectedData] of expectedValues) {
            const retrievedData = await offlineStorage.getCachedData(key);
            // Handle floating point precision issues and special cases
            if (typeof expectedData === 'number' && typeof retrievedData === 'number') {
              // Handle very large numbers that may have precision issues
              if (Math.abs(expectedData) > 1e15 || Math.abs(retrievedData) > 1e15) {
                // For very large numbers, use relative tolerance
                const relativeError = Math.abs(retrievedData - expectedData) / Math.max(Math.abs(expectedData), Math.abs(retrievedData));
                expect(relativeError).toBeLessThan(1e-10);
              } else {
                expect(Math.abs(retrievedData - expectedData)).toBeLessThan(1e-10);
              }
            } else {
              expect(retrievedData).toEqual(expectedData);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 10000);

  test('Property 14.8: Offline storage should handle concurrent operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            url: fc.webUrl(),
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            headers: fc.dictionary(fc.string(), fc.string()),
            body: fc.string(),
            type: fc.constantFrom('form', 'api', 'sync')
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (offlineDataArray) => {
          // Ensure we start with a clean slate
          await offlineStorage.clearAllData();
          
          // Verify we start with empty storage
          const initialData = await offlineStorage.getOfflineData();
          expect(initialData.length).toBe(0);
          
          // Queue all items concurrently
          const queuePromises = offlineDataArray.map(data => 
            offlineStorage.queueOfflineData(data)
          );
          const ids = await Promise.all(queuePromises);
          
          // Verify all items were queued
          const retrievedData = await offlineStorage.getOfflineData();
          
          expect(retrievedData.length).toBe(offlineDataArray.length);
          
          // Verify all IDs are present
          const retrievedIds = retrievedData.map(item => item.id);
          for (const id of ids) {
            expect(retrievedIds).toContain(id);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 10000);
});

// Additional integration tests for offline functionality
describe('Offline Functionality Integration Tests', () => {
  test('should handle form submission queuing workflow', async () => {
    const formData = {
      name: 'Test Project',
      description: 'Test Description',
      priority: 'high'
    };
    
    // Queue form submission
    const id = await offlineStorage.queueOfflineData({
      url: '/api/projects',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      type: 'form',
      metadata: { submittedAt: new Date().toISOString() }
    });
    
    // Verify queued data
    const queuedData = await offlineStorage.getOfflineData();
    const queuedItem = queuedData.find(item => item.id === id);
    
    expect(queuedItem).toBeDefined();
    expect(queuedItem!.type).toBe('form');
    expect(JSON.parse(queuedItem!.body)).toEqual(formData);
    
    // Simulate successful sync by removing the item
    await offlineStorage.removeOfflineData(id);
    
    // Verify removal
    const remainingData = await offlineStorage.getOfflineData();
    expect(remainingData.find(item => item.id === id)).toBeUndefined();
  }, 10000);

  test('should handle cache-first data access pattern', async () => {
    const cacheKey = 'dashboard-data';
    const dashboardData = {
      projects: [
        { id: 1, name: 'Project A', status: 'active' },
        { id: 2, name: 'Project B', status: 'completed' }
      ],
      metrics: {
        totalProjects: 2,
        activeProjects: 1,
        completedProjects: 1
      }
    };
    
    // Cache dashboard data
    await offlineStorage.cacheData(cacheKey, dashboardData, 24 * 60 * 60 * 1000); // 24 hours
    
    // Retrieve cached data
    const cachedData = await offlineStorage.getCachedData(cacheKey);
    
    expect(cachedData).toEqual(dashboardData);
    expect(cachedData.projects).toHaveLength(2);
    expect(cachedData.metrics.totalProjects).toBe(2);
  }, 10000);
});