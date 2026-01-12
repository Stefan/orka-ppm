'use client';

import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService, NotificationPayload, PushSubscriptionData } from '@/lib/services/push-notifications';
import { offlineStorage } from '@/lib/offline-storage';

interface NotificationPreferences {
  enabled: boolean;
  projectUpdates: boolean;
  riskAlerts: boolean;
  resourceAlerts: boolean;
  systemNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
}

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscription: PushSubscriptionData | null;
  preferences: NotificationPreferences;
  isLoading: boolean;
}

const defaultPreferences: NotificationPreferences = {
  enabled: true,
  projectUpdates: true,
  riskAlerts: true,
  resourceAlerts: true,
  systemNotifications: false,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00'
  }
};

export function usePushNotifications(userId?: string) {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    subscription: null,
    preferences: defaultPreferences,
    isLoading: true
  });

  /**
   * Initialize push notifications
   */
  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const isSupported = pushNotificationService.isSupported();
      const permission = pushNotificationService.getPermissionStatus();
      
      let subscription: PushSubscriptionData | null = null;
      let isSubscribed = false;

      if (isSupported && permission === 'granted') {
        await pushNotificationService.initialize();
        subscription = await pushNotificationService.getSubscription();
        isSubscribed = subscription !== null;
      }

      // Load preferences from storage
      const savedPreferences = await offlineStorage.getPreference('notificationPreferences');
      const preferences = savedPreferences || defaultPreferences;

      setState({
        isSupported,
        permission,
        isSubscribed,
        subscription,
        preferences,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  /**
   * Request notification permission and subscribe
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const subscription = await pushNotificationService.subscribe(userId);
      
      if (subscription) {
        setState(prev => ({
          ...prev,
          permission: 'granted',
          isSubscribed: true,
          subscription,
          isLoading: false
        }));
        return true;
      } else {
        setState(prev => ({
          ...prev,
          permission: pushNotificationService.getPermissionStatus(),
          isLoading: false
        }));
        return false;
      }
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [userId]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const success = await pushNotificationService.unsubscribe();
      
      if (success) {
        setState(prev => ({
          ...prev,
          isSubscribed: false,
          subscription: null,
          isLoading: false
        }));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }

      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  /**
   * Update notification preferences
   */
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    try {
      const updatedPreferences = { ...state.preferences, ...newPreferences };
      
      // Save to storage
      await offlineStorage.storePreference('notificationPreferences', updatedPreferences);
      
      setState(prev => ({
        ...prev,
        preferences: updatedPreferences
      }));

      // If notifications are being disabled, unsubscribe
      if (!updatedPreferences.enabled && state.isSubscribed) {
        await unsubscribe();
      }
      // If notifications are being enabled and not subscribed, subscribe
      else if (updatedPreferences.enabled && !state.isSubscribed && state.permission !== 'denied') {
        await subscribe();
      }

      return true;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }, [state.preferences, state.isSubscribed, state.permission, subscribe, unsubscribe]);

  /**
   * Show a test notification
   */
  const showTestNotification = useCallback(async () => {
    try {
      if (!state.isSubscribed) {
        throw new Error('Not subscribed to push notifications');
      }

      const payload: NotificationPayload = {
        title: 'Test Notification',
        body: 'This is a test notification from Orka PPM',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: 'test-notification',
        data: {
          type: 'test',
          timestamp: Date.now()
        },
        actions: [
          {
            action: 'view',
            title: 'View Details'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      };

      await pushNotificationService.showLocalNotification(payload);
      return true;
    } catch (error) {
      console.error('Failed to show test notification:', error);
      return false;
    }
  }, [state.isSubscribed]);

  /**
   * Check if notifications should be shown based on quiet hours
   */
  const shouldShowNotification = useCallback((type: keyof Omit<NotificationPreferences, 'enabled' | 'quietHours'>): boolean => {
    if (!state.preferences.enabled || !state.preferences[type]) {
      return false;
    }

    // Check quiet hours
    if (state.preferences.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const { start, end } = state.preferences.quietHours;
      
      // Handle quiet hours that span midnight
      if (start > end) {
        if (currentTime >= start || currentTime <= end) {
          return false;
        }
      } else {
        if (currentTime >= start && currentTime <= end) {
          return false;
        }
      }
    }

    return true;
  }, [state.preferences]);

  /**
   * Send notification to server for delivery
   */
  const sendNotification = useCallback(async (
    type: keyof Omit<NotificationPreferences, 'enabled' | 'quietHours'>,
    payload: NotificationPayload
  ) => {
    try {
      if (!shouldShowNotification(type)) {
        console.log('Notification blocked by preferences or quiet hours');
        return false;
      }

      // Send to server for delivery
      const response = await fetch('/api/push-notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          type,
          payload
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }, [userId, shouldShowNotification]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Listen for permission changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-check permission when page becomes visible
        const currentPermission = pushNotificationService.getPermissionStatus();
        if (currentPermission !== state.permission) {
          setState(prev => ({ ...prev, permission: currentPermission }));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.permission]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    updatePreferences,
    showTestNotification,
    shouldShowNotification,
    sendNotification,
    initialize
  };
}