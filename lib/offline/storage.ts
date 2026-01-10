/**
 * Offline Storage System using IndexedDB
 * Handles offline data storage, form submission queuing, and background sync
 */

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

interface CachedData {
  id: string;
  key: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
}

class OfflineStorageManager {
  private dbName = 'orka-ppm-offline';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  /**
   * Initialize IndexedDB database
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create offline data store for queued requests
        if (!db.objectStoreNames.contains('offlineData')) {
          const offlineStore = db.createObjectStore('offlineData', { keyPath: 'id' });
          offlineStore.createIndex('timestamp', 'timestamp', { unique: false });
          offlineStore.createIndex('type', 'type', { unique: false });
        }

        // Create cached data store for offline access
        if (!db.objectStoreNames.contains('cachedData')) {
          const cacheStore = db.createObjectStore('cachedData', { keyPath: 'id' });
          cacheStore.createIndex('key', 'key', { unique: false });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create user preferences store
        if (!db.objectStoreNames.contains('userPreferences')) {
          db.createObjectStore('userPreferences', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Ensure database is ready
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  /**
   * Queue offline data for background sync
   */
  async queueOfflineData(data: Omit<OfflineData, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const db = await this.ensureDB();
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const offlineData: OfflineData = {
      ...data,
      id,
      timestamp: Date.now(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const request = store.add(offlineData);

      request.onsuccess = () => {
        console.log('Offline data queued:', id);
        resolve(id);
      };

      request.onerror = () => {
        console.error('Failed to queue offline data:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all queued offline data
   */
  async getOfflineData(): Promise<OfflineData[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('Failed to get offline data:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Remove successfully synced offline data
   */
  async removeOfflineData(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Offline data removed:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to remove offline data:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update retry count for failed sync attempts
   */
  async updateRetryCount(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.retryCount += 1;
          const updateRequest = store.put(data);
          
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Offline data not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Cache data for offline access
   */
  async cacheData(key: string, data: any, expiresIn?: number): Promise<void> {
    const db = await this.ensureDB();
    const id = `cache_${key}_${Date.now()}`;
    
    const cachedData: CachedData = {
      id,
      key,
      data,
      timestamp: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn : undefined
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['cachedData'], 'readwrite');
      const store = transaction.objectStore('cachedData');
      
      // Remove old cache entries for the same key
      const index = store.index('key');
      const deleteRequest = index.openCursor(IDBKeyRange.only(key));
      
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Add new cache entry
          const addRequest = store.add(cachedData);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        }
      };

      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  /**
   * Get cached data
   */
  async getCachedData(key: string): Promise<any | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['cachedData'], 'readonly');
      const store = transaction.objectStore('cachedData');
      const index = store.index('key');
      const request = index.get(key);

      request.onsuccess = () => {
        const result = request.result;
        
        if (!result) {
          resolve(null);
          return;
        }

        // Check if data has expired
        if (result.expiresAt && Date.now() > result.expiresAt) {
          // Remove expired data
          this.removeCachedData(key);
          resolve(null);
          return;
        }

        resolve(result.data);
      };

      request.onerror = () => {
        console.error('Failed to get cached data:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Remove cached data
   */
  async removeCachedData(key: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['cachedData'], 'readwrite');
      const store = transaction.objectStore('cachedData');
      const index = store.index('key');
      const request = index.openCursor(IDBKeyRange.only(key));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store user preferences
   */
  async storePreference(key: string, value: any): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userPreferences'], 'readwrite');
      const store = transaction.objectStore('userPreferences');
      const request = store.put({ key, value, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get user preference
   */
  async getPreference(key: string): Promise<any | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userPreferences'], 'readonly');
      const store = transaction.objectStore('userPreferences');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all offline data (for testing/debugging)
   */
  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineData', 'cachedData', 'userPreferences'], 'readwrite');
      
      const clearPromises = [
        new Promise<void>((res, rej) => {
          const req = transaction.objectStore('offlineData').clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
        new Promise<void>((res, rej) => {
          const req = transaction.objectStore('cachedData').clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
        new Promise<void>((res, rej) => {
          const req = transaction.objectStore('userPreferences').clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        })
      ];

      Promise.all(clearPromises)
        .then(() => resolve())
        .catch(reject);
    });
  }
}

// Create singleton instance
export const offlineStorage = new OfflineStorageManager();

// Export types for use in other modules
export type { OfflineData, CachedData };