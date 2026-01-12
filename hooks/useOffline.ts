'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineStorage } from '@/lib/offline-storage';

interface UseOfflineOptions {
  enableBackgroundSync?: boolean;
  syncInterval?: number;
}

interface OfflineState {
  isOnline: boolean;
  isBackgroundSyncing: boolean;
  queuedItems: number;
  lastSyncTime: Date | null;
}

export function useOffline(options: UseOfflineOptions = {}) {
  const { enableBackgroundSync = true, syncInterval = 30000 } = options;
  
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isBackgroundSyncing: false,
    queuedItems: 0,
    lastSyncTime: null
  });

  /**
   * Queue a request for offline sync
   */
  const queueRequest = useCallback(async (
    url: string,
    options: RequestInit & { metadata?: Record<string, any> } = {}
  ) => {
    const { metadata, ...requestOptions } = options;
    
    try {
      const id = await offlineStorage.queueOfflineData({
        url,
        method: requestOptions.method || 'GET',
        headers: (requestOptions.headers as Record<string, string>) || {},
        body: requestOptions.body as string || '',
        type: 'api',
        metadata
      });

      // Update queued items count
      const queuedData = await offlineStorage.getOfflineData();
      setState(prev => ({ ...prev, queuedItems: queuedData.length }));

      // Register background sync if supported
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        // Type assertion for background sync API
        await (registration as any).sync.register('background-sync');
      }

      return id;
    } catch (error) {
      console.error('Failed to queue offline request:', error);
      throw error;
    }
  }, []);

  /**
   * Queue form data for offline submission
   */
  const queueFormSubmission = useCallback(async (
    url: string,
    formData: FormData | Record<string, any>,
    method: string = 'POST'
  ) => {
    try {
      const body = formData instanceof FormData 
        ? JSON.stringify(Object.fromEntries(formData.entries()))
        : JSON.stringify(formData);

      const id = await offlineStorage.queueOfflineData({
        url,
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
        type: 'form',
        metadata: { submittedAt: new Date().toISOString() }
      });

      // Update queued items count
      const queuedData = await offlineStorage.getOfflineData();
      setState(prev => ({ ...prev, queuedItems: queuedData.length }));

      return id;
    } catch (error) {
      console.error('Failed to queue form submission:', error);
      throw error;
    }
  }, []);

  /**
   * Cache data for offline access
   */
  const cacheData = useCallback(async (
    key: string,
    data: any,
    expiresInMs?: number
  ) => {
    try {
      await offlineStorage.cacheData(key, data, expiresInMs);
    } catch (error) {
      console.error('Failed to cache data:', error);
      throw error;
    }
  }, []);

  /**
   * Get cached data
   */
  const getCachedData = useCallback(async (key: string) => {
    try {
      return await offlineStorage.getCachedData(key);
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }, []);

  /**
   * Perform background sync
   */
  const performBackgroundSync = useCallback(async () => {
    if (state.isBackgroundSyncing || !state.isOnline) {
      return;
    }

    setState(prev => ({ ...prev, isBackgroundSyncing: true }));

    try {
      const queuedData = await offlineStorage.getOfflineData();
      
      for (const item of queuedData) {
        try {
          const response = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            ...(item.body && { body: item.body })
          });

          if (response.ok) {
            await offlineStorage.removeOfflineData(item.id);
            console.log('Successfully synced item:', item.id);
          } else {
            // Update retry count for failed attempts
            await offlineStorage.updateRetryCount(item.id);
            console.warn('Failed to sync item:', item.id, response.status);
          }
        } catch (error) {
          console.error('Sync error for item:', item.id, error);
          await offlineStorage.updateRetryCount(item.id);
        }
      }

      // Update state
      const remainingData = await offlineStorage.getOfflineData();
      setState(prev => ({
        ...prev,
        queuedItems: remainingData.length,
        lastSyncTime: new Date(),
        isBackgroundSyncing: false
      }));

    } catch (error) {
      console.error('Background sync failed:', error);
      setState(prev => ({ ...prev, isBackgroundSyncing: false }));
    }
  }, [state.isBackgroundSyncing, state.isOnline]);

  /**
   * Enhanced fetch that handles offline scenarios
   */
  const offlineFetch = useCallback(async (
    url: string,
    options: RequestInit & { 
      cacheKey?: string;
      cacheFirst?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ) => {
    const { cacheKey, cacheFirst = false, metadata, ...fetchOptions } = options;

    // If offline, try to get cached data or queue request
    if (!state.isOnline) {
      if (cacheKey) {
        const cachedData = await getCachedData(cacheKey);
        if (cachedData) {
          return new Response(JSON.stringify(cachedData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Queue for background sync
      await queueRequest(url, { 
        ...fetchOptions, 
        ...(metadata && { metadata })
      });
      throw new Error('Request queued for background sync - currently offline');
    }

    // If cache-first strategy and we have cached data
    if (cacheFirst && cacheKey) {
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        // Return cached data immediately, but update in background
        fetch(url, fetchOptions)
          .then(response => response.json())
          .then(data => cacheData(cacheKey, data))
          .catch(console.error);

        return new Response(JSON.stringify(cachedData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    try {
      const response = await fetch(url, fetchOptions);
      
      // Cache successful responses
      if (response.ok && cacheKey && fetchOptions.method !== 'POST') {
        const data = await response.clone().json();
        await cacheData(cacheKey, data, 24 * 60 * 60 * 1000); // Cache for 24 hours
      }

      return response;
    } catch (error) {
      // If fetch fails and we have cached data, return it
      if (cacheKey) {
        const cachedData = await getCachedData(cacheKey);
        if (cachedData) {
          return new Response(JSON.stringify(cachedData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      throw error;
    }
  }, [state.isOnline, getCachedData, cacheData, queueRequest]);

  // Set up online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      
      // Trigger background sync when coming back online
      if (enableBackgroundSync) {
        setTimeout(performBackgroundSync, 1000);
      }
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableBackgroundSync, performBackgroundSync]);

  // Set up periodic background sync
  useEffect(() => {
    if (!enableBackgroundSync || !state.isOnline) {
      return;
    }

    const interval = setInterval(() => {
      if (state.queuedItems > 0) {
        performBackgroundSync();
      }
    }, syncInterval);

    return () => clearInterval(interval);
  }, [enableBackgroundSync, state.isOnline, state.queuedItems, syncInterval, performBackgroundSync]);

  // Initialize queued items count
  useEffect(() => {
    const initializeQueueCount = async () => {
      try {
        const queuedData = await offlineStorage.getOfflineData();
        setState(prev => ({ ...prev, queuedItems: queuedData.length }));
      } catch (error) {
        console.error('Failed to initialize queue count:', error);
      }
    };

    initializeQueueCount();
  }, []);

  return {
    ...state,
    queueRequest,
    queueFormSubmission,
    cacheData,
    getCachedData,
    performBackgroundSync,
    offlineFetch
  };
}