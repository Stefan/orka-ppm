/**
 * Simple offline storage utility
 */

interface OfflineStorageItem {
  id: string
  data: any
  timestamp: Date
  synced: boolean
}

interface OfflineDataItem {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  type?: string
  metadata?: any
  timestamp: Date
  retryCount: number
}

interface CachedDataItem {
  key: string
  data: any
  timestamp: Date
  expiresAt: Date
}

class OfflineStorage {
  private storageKey = 'offline-storage'
  private offlineDataKey = 'offline-data'
  private cachedDataKey = 'cached-data'

  getItems(): OfflineStorageItem[] {
    try {
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  addItem(id: string, data: any): void {
    const items = this.getItems()
    const newItem: OfflineStorageItem = {
      id,
      data,
      timestamp: new Date(),
      synced: false
    }
    items.push(newItem)
    localStorage.setItem(this.storageKey, JSON.stringify(items))
  }

  markSynced(id: string): void {
    const items = this.getItems()
    const item = items.find(i => i.id === id)
    if (item) {
      item.synced = true
      localStorage.setItem(this.storageKey, JSON.stringify(items))
    }
  }

  getUnsyncedItems(): OfflineStorageItem[] {
    return this.getItems().filter(item => !item.synced)
  }

  clearSyncedItems(): void {
    const items = this.getItems().filter(item => !item.synced)
    localStorage.setItem(this.storageKey, JSON.stringify(items))
  }

  // Offline data methods
  async queueOfflineData(data: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
    type?: string
    metadata?: any
  }): Promise<string> {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const items = await this.getOfflineData()
    const newItem: OfflineDataItem = {
      id,
      ...data,
      timestamp: new Date(),
      retryCount: 0
    }
    items.push(newItem)
    localStorage.setItem(this.offlineDataKey, JSON.stringify(items))
    return id
  }

  async getOfflineData(): Promise<OfflineDataItem[]> {
    try {
      const stored = localStorage.getItem(this.offlineDataKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  async removeOfflineData(id: string): Promise<void> {
    const items = await this.getOfflineData()
    const filtered = items.filter(item => item.id !== id)
    localStorage.setItem(this.offlineDataKey, JSON.stringify(filtered))
  }

  async updateRetryCount(id: string): Promise<void> {
    const items = await this.getOfflineData()
    const item = items.find(i => i.id === id)
    if (item) {
      item.retryCount += 1
      localStorage.setItem(this.offlineDataKey, JSON.stringify(items))
    }
  }

  // Cache methods
  async cacheData(key: string, data: any, expiresInMs?: number): Promise<void> {
    const items = this.getCachedDataItems()
    const expiresAt = expiresInMs 
      ? new Date(Date.now() + expiresInMs)
      : new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours default

    const newItem: CachedDataItem = {
      key,
      data,
      timestamp: new Date(),
      expiresAt
    }

    const filtered = items.filter(item => item.key !== key)
    filtered.push(newItem)
    localStorage.setItem(this.cachedDataKey, JSON.stringify(filtered))
  }

  async getCachedData(key: string): Promise<any | null> {
    const items = this.getCachedDataItems()
    const item = items.find(i => i.key === key)
    
    if (!item) return null
    
    // Check if expired
    if (new Date() > new Date(item.expiresAt)) {
      // Remove expired item
      const filtered = items.filter(i => i.key !== key)
      localStorage.setItem(this.cachedDataKey, JSON.stringify(filtered))
      return null
    }
    
    return item.data
  }

  private getCachedDataItems(): CachedDataItem[] {
    try {
      const stored = localStorage.getItem(this.cachedDataKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  // Preference methods
  async getPreference(key: string): Promise<any | null> {
    try {
      const stored = localStorage.getItem(`preference-${key}`)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  async storePreference(key: string, value: any): Promise<void> {
    try {
      localStorage.setItem(`preference-${key}`, JSON.stringify(value))
    } catch (error) {
      console.error('Failed to store preference:', error)
    }
  }
}

export const offlineStorage = new OfflineStorage()