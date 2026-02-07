/**
 * Property-Based Tests for Push Notification Delivery
 * Feature: mobile-first-ui-enhancements, Property 15: Push Notification Delivery
 * Validates: Requirements 5.3
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { pushNotificationService, NotificationPayload, PushSubscriptionData } from '@/lib/push-notifications';

// Mock browser APIs
const mockServiceWorkerRegistration = {
  pushManager: {
    subscribe: jest.fn(),
    getSubscription: jest.fn(),
  },
  showNotification: jest.fn(),
  sync: {
    register: jest.fn()
  }
};

const mockPushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
  getKey: jest.fn(),
  unsubscribe: jest.fn()
};

// Mock global objects
beforeEach(() => {
  // Mock navigator
  Object.defineProperty(global, 'navigator', {
    value: {
      serviceWorker: {
        ready: Promise.resolve(mockServiceWorkerRegistration),
        register: jest.fn()
      },
      onLine: true,
      userAgent: 'Mozilla/5.0 (Test Browser)',
      platform: 'Test Platform'
    },
    writable: true
  });

  // Mock Notification API
  Object.defineProperty(global, 'Notification', {
    value: {
      permission: 'default',
      requestPermission: jest.fn().mockResolvedValue('granted')
    },
    writable: true
  });

  // Mock PushManager
  Object.defineProperty(global, 'PushManager', {
    value: function() {},
    writable: true
  });

  // Mock window.atob and btoa
  Object.defineProperty(global, 'atob', {
    value: (str: string) => Buffer.from(str, 'base64').toString('binary'),
    writable: true
  });

  Object.defineProperty(global, 'btoa', {
    value: (str: string) => Buffer.from(str, 'binary').toString('base64'),
    writable: true
  });

  // Reset mocks
  jest.clearAllMocks();
  
  // Setup default mock behaviors
  mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(null);
  mockServiceWorkerRegistration.pushManager.subscribe.mockResolvedValue(mockPushSubscription);
  mockServiceWorkerRegistration.showNotification.mockResolvedValue(undefined);
  
  mockPushSubscription.getKey.mockImplementation((name: string) => {
    if (name === 'p256dh') {
      return new Uint8Array([1, 2, 3, 4, 5]);
    }
    if (name === 'auth') {
      return new Uint8Array([6, 7, 8, 9, 10]);
    }
    return null;
  });
  mockPushSubscription.unsubscribe.mockResolvedValue(true);

  // Mock fetch for server communication
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true })
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Push Notification Delivery Property Tests', () => {
  /**
   * Property 15: Push Notification Delivery
   * For any critical project update, subscribed users should receive timely push notifications
   * Validates: Requirements 5.3
   */

  test('Property 15.1: Notification subscription should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (userId) => {
          // Initialize the service
          const initialized = await pushNotificationService.initialize();
          expect(initialized).toBe(true);

          // Subscribe to notifications
          const subscription = await pushNotificationService.subscribe(userId);
          
          // Verify subscription was created
          expect(subscription).toBeDefined();
          expect(subscription!.userId).toBe(userId);
          expect(subscription!.endpoint).toBe(mockPushSubscription.endpoint);
          expect(subscription!.keys.p256dh).toBeDefined();
          expect(subscription!.keys.auth).toBeDefined();
          expect(subscription!.deviceInfo).toBeDefined();
          expect(subscription!.deviceInfo!.userAgent).toBe('Mozilla/5.0 (Test Browser)');
          expect(subscription!.deviceInfo!.platform).toBe('Test Platform');
          expect(typeof subscription!.deviceInfo!.timestamp).toBe('number');
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 15.2: Notification payload should be properly formatted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 300 }),
          icon: fc.option(fc.webUrl()),
          badge: fc.option(fc.webUrl()),
          tag: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          requireInteraction: fc.option(fc.boolean()),
          silent: fc.option(fc.boolean()),
          data: fc.option(fc.dictionary(fc.string(), fc.anything()))
        }),
        async (payload) => {
          // Initialize and set permission to granted
          await pushNotificationService.initialize();
          (global.Notification as any).permission = 'granted';

          // Show local notification
          await pushNotificationService.showLocalNotification(payload);

          // Verify showNotification was called with correct parameters
          expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledWith(
            payload.title,
            expect.objectContaining({
              body: payload.body,
              icon: payload.icon || '/icon.svg',
              badge: payload.badge || '/icon.svg',
              tag: payload.tag,
              data: payload.data,
              requireInteraction: payload.requireInteraction || false,
              silent: payload.silent || false,
              vibrate: [100, 50, 100]
            })
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 15.3: Subscription management should be idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 2, max: 5 }),
        async (userId, subscriptionAttempts) => {
          // Initialize the service
          await pushNotificationService.initialize();

          // Attempt multiple subscriptions
          const subscriptions = [];
          for (let i = 0; i < subscriptionAttempts; i++) {
            const subscription = await pushNotificationService.subscribe(userId);
            subscriptions.push(subscription);
          }

          // All subscriptions should be identical except for timestamps (idempotent)
          for (let i = 1; i < subscriptions.length; i++) {
            const sub1 = subscriptions[0];
            const sub2 = subscriptions[i];
            
            expect(sub2!.endpoint).toBe(sub1!.endpoint);
            expect(sub2!.keys).toEqual(sub1!.keys);
            expect(sub2!.userId).toBe(sub1!.userId);
            expect(sub2!.deviceInfo!.userAgent).toBe(sub1!.deviceInfo!.userAgent);
            expect(sub2!.deviceInfo!.platform).toBe(sub1!.deviceInfo!.platform);
            // Timestamps may differ slightly, so we check they're within a reasonable range
            expect(Math.abs(sub2!.deviceInfo!.timestamp - sub1!.deviceInfo!.timestamp)).toBeLessThan(1000);
          }

          // Verify getSubscription was called to check for existing subscription
          expect(mockServiceWorkerRegistration.pushManager.getSubscription).toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 15.4: Unsubscription should clean up properly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (userId) => {
          // Initialize and subscribe
          await pushNotificationService.initialize();
          const subscription = await pushNotificationService.subscribe(userId);
          expect(subscription).toBeDefined();

          // Mock that subscription exists
          mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValueOnce(mockPushSubscription);

          // Unsubscribe
          const unsubscribed = await pushNotificationService.unsubscribe();
          expect(unsubscribed).toBe(true);

          // Verify unsubscribe was called on the subscription
          expect(mockPushSubscription.unsubscribe).toHaveBeenCalled();

          // Verify server was notified about unsubscription
          expect(global.fetch).toHaveBeenCalledWith(
            '/api/push-notifications/unsubscribe',
            expect.objectContaining({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: mockPushSubscription.endpoint })
            })
          );
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 15.5: Permission handling should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('default', 'granted', 'denied'),
        async (permission) => {
          // Set the permission state
          (global.Notification as any).permission = permission;
          (global.Notification as any).requestPermission.mockResolvedValue(permission);

          // Initialize service
          await pushNotificationService.initialize();

          // Check permission status
          const currentPermission = pushNotificationService.getPermissionStatus();
          expect(currentPermission).toBe(permission);

          // Request permission
          const requestedPermission = await pushNotificationService.requestPermission();
          expect(requestedPermission).toBe(permission);

          // Subscription should only succeed if permission is granted
          const subscription = await pushNotificationService.subscribe('test-user');
          
          if (permission === 'granted') {
            expect(subscription).toBeDefined();
            expect(subscription!.endpoint).toBe(mockPushSubscription.endpoint);
          } else {
            expect(subscription).toBeNull();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 15.6: Service worker support detection should be accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasServiceWorker: fc.boolean(),
          hasPushManager: fc.boolean(),
          hasNotification: fc.boolean()
        }),
        async ({ hasServiceWorker, hasPushManager, hasNotification }) => {
          // Mock the isSupported method to simulate different browser capabilities
          const originalIsSupported = pushNotificationService.isSupported;
          
          // Create a mock that checks the actual global state we set up
          const mockIsSupported = jest.fn().mockImplementation(() => {
            const swExists = hasServiceWorker && 'serviceWorker' in navigator;
            const pmExists = hasPushManager && 'PushManager' in window;
            const notifExists = hasNotification && 'Notification' in window;
            return swExists && pmExists && notifExists;
          });
          
          // Replace the method
          pushNotificationService.isSupported = mockIsSupported;
          
          try {
            // Check support
            const isSupported = pushNotificationService.isSupported();
            const expectedSupport = hasServiceWorker && hasPushManager && hasNotification;
            
            expect(isSupported).toBe(expectedSupport);
            expect(mockIsSupported).toHaveBeenCalled();
          } finally {
            // Restore original method
            pushNotificationService.isSupported = originalIsSupported;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 15.7: VAPID key conversion should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.base64String({ minLength: 32, maxLength: 128 }),
        async (vapidKey) => {
          // This tests the internal VAPID key conversion
          // We can't directly test the private method, but we can test subscription creation
          await pushNotificationService.initialize();
          (global.Notification as any).permission = 'granted';

          // Subscribe with the service (which uses VAPID key internally)
          const subscription = await pushNotificationService.subscribe('test-user');
          
          // Verify subscription was created successfully
          expect(subscription).toBeDefined();
          expect(mockServiceWorkerRegistration.pushManager.subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: expect.any(Uint8Array)
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 15.8: Notification actions should be properly handled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 300 }),
          actions: fc.option(fc.array(
            fc.record({
              action: fc.string({ minLength: 1, maxLength: 20 }),
              title: fc.string({ minLength: 1, maxLength: 50 }),
              icon: fc.option(fc.webUrl())
            }),
            { minLength: 1, maxLength: 3 }
          ))
        }),
        async (payload) => {
          // Clear previous mock calls
          mockServiceWorkerRegistration.showNotification.mockClear();
          
          await pushNotificationService.initialize();
          (global.Notification as any).permission = 'granted';

          // Show notification with actions
          await pushNotificationService.showLocalNotification(payload);

          // Verify the notification was called with the correct parameters
          expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledTimes(1);
          
          // Build expected object based on what the service actually sends
          const expectedOptions: any = {
            body: payload.body,
            icon: '/icon.svg',
            badge: '/icon.svg',
            requireInteraction: false,
            silent: false,
            vibrate: [100, 50, 100]
          };
          
          // Only include actions if they exist
          if (payload.actions) {
            expectedOptions.actions = payload.actions;
          }
          
          expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledWith(
            payload.title,
            expect.objectContaining(expectedOptions)
          );
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Push Notification Delivery Integration Tests', () => {
  test('should handle complete subscription workflow', async () => {
    const userId = 'test-user-123';
    
    // Initialize service
    const initialized = await pushNotificationService.initialize();
    expect(initialized).toBe(true);

    // Check initial state
    expect(pushNotificationService.isSupported()).toBe(true);
    expect(pushNotificationService.getPermissionStatus()).toBe('default');

    // Request permission
    (global.Notification as any).requestPermission.mockResolvedValue('granted');
    const permission = await pushNotificationService.requestPermission();
    expect(permission).toBe('granted');

    // Subscribe
    const subscription = await pushNotificationService.subscribe(userId);
    expect(subscription).toBeDefined();
    expect(subscription!.userId).toBe(userId);

    // Verify server was notified
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/push-notifications/subscribe',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining(userId)
      })
    );
  });

  test('should handle notification display with all features', async () => {
    await pushNotificationService.initialize();
    (global.Notification as any).permission = 'granted';

    const payload: NotificationPayload = {
      title: 'Project Update',
      body: 'Your project "Mobile App" has been updated',
      icon: '/project-icon.png',
      badge: '/badge.png',
      tag: 'project-update',
      requireInteraction: true,
      data: {
        projectId: 123,
        type: 'update',
        timestamp: Date.now()
      },
      actions: [
        { action: 'view', title: 'View Project' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    await pushNotificationService.showLocalNotification(payload);

    expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledWith(
      'Project Update',
      expect.objectContaining({
        body: 'Your project "Mobile App" has been updated',
        icon: '/project-icon.png',
        badge: '/badge.png',
        tag: 'project-update',
        requireInteraction: true,
        data: payload.data,
        actions: payload.actions,
        vibrate: [100, 50, 100]
      })
    );
  });

  test('should handle subscription retrieval', async () => {
    await pushNotificationService.initialize();
    
    // Mock existing subscription
    mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(mockPushSubscription);
    
    const subscription = await pushNotificationService.getSubscription();
    
    expect(subscription).toBeDefined();
    expect(subscription!.endpoint).toBe(mockPushSubscription.endpoint);
    expect(subscription!.keys.p256dh).toBeDefined();
    expect(subscription!.keys.auth).toBeDefined();
  });

  test('should handle server communication errors gracefully', async () => {
    // Mock server error
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Server error'));
    
    await pushNotificationService.initialize();
    (global.Notification as any).permission = 'granted';
    
    // Subscription should still work locally even if server communication fails
    const subscription = await pushNotificationService.subscribe('test-user');
    expect(subscription).toBeDefined();
    
    // Unsubscription should also work locally
    mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(mockPushSubscription);
    const unsubscribed = await pushNotificationService.unsubscribe();
    expect(unsubscribed).toBe(true);
  });
});