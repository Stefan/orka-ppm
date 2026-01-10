'use client';

import { useState } from 'react';
import { Bell, BellOff, Settings, TestTube, Clock, Shield, AlertTriangle, Users, Monitor } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface NotificationSettingsProps {
  userId?: string;
  className?: string;
}

export default function NotificationSettings({ userId, className = '' }: NotificationSettingsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  
  const {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    isLoading,
    subscribe,
    unsubscribe,
    updatePreferences,
    showTestNotification
  } = usePushNotifications(userId);

  const handleToggleNotifications = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handlePreferenceChange = async (key: string, value: any) => {
    await updatePreferences({ [key]: value });
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    try {
      const success = await showTestNotification();
      if (!success) {
        alert('Failed to send test notification. Please check your settings.');
      }
    } finally {
      setIsTestingNotification(false);
    }
  };

  if (!isSupported) {
    return (
      <div className={`p-4 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <div className="flex items-center">
          <BellOff className="w-5 h-5 text-yellow-600 mr-2" />
          <span className="text-sm text-yellow-800">
            Push notifications are not supported in this browser.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Main Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-blue-600" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Push Notifications
              </h3>
              <p className="text-sm text-gray-600">
                {isSubscribed 
                  ? 'Receive notifications for important project updates'
                  : 'Enable notifications to stay updated on project changes'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Settings Button */}
            {isSubscribed && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            
            {/* Main Toggle */}
            <button
              onClick={handleToggleNotifications}
              disabled={isLoading || permission === 'denied'}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${isSubscribed ? 'bg-blue-600' : 'bg-gray-200'}
                ${isLoading || permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${isSubscribed ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>

        {/* Permission Denied Warning */}
        {permission === 'denied' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800">
                  Notifications Blocked
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  You've blocked notifications for this site. To enable them, click the lock icon in your browser's address bar and allow notifications.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Setting up notifications...
          </div>
        )}
      </div>

      {/* Detailed Settings */}
      {showSettings && isSubscribed && (
        <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              Notification Preferences
            </h4>
            <button
              onClick={handleTestNotification}
              disabled={isTestingNotification}
              className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
            >
              <TestTube className={`w-4 h-4 mr-2 ${isTestingNotification ? 'animate-pulse' : ''}`} />
              {isTestingNotification ? 'Sending...' : 'Test Notification'}
            </button>
          </div>

          <div className="space-y-4">
            {/* Project Updates */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-blue-500" />
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Project Updates
                  </label>
                  <p className="text-xs text-gray-600">
                    Status changes, milestones, and progress updates
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePreferenceChange('projectUpdates', !preferences.projectUpdates)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${preferences.projectUpdates ? 'bg-blue-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                    ${preferences.projectUpdates ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Risk Alerts */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Risk Alerts
                  </label>
                  <p className="text-xs text-gray-600">
                    High-priority risks and escalations
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePreferenceChange('riskAlerts', !preferences.riskAlerts)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${preferences.riskAlerts ? 'bg-blue-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                    ${preferences.riskAlerts ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Resource Alerts */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-green-500" />
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Resource Alerts
                  </label>
                  <p className="text-xs text-gray-600">
                    Resource conflicts and availability changes
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePreferenceChange('resourceAlerts', !preferences.resourceAlerts)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${preferences.resourceAlerts ? 'bg-blue-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                    ${preferences.resourceAlerts ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* System Notifications */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Monitor className="w-5 h-5 text-gray-500" />
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    System Notifications
                  </label>
                  <p className="text-xs text-gray-600">
                    Maintenance, updates, and system messages
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePreferenceChange('systemNotifications', !preferences.systemNotifications)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${preferences.systemNotifications ? 'bg-blue-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                    ${preferences.systemNotifications ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Quiet Hours */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-900">
                      Quiet Hours
                    </label>
                    <p className="text-xs text-gray-600">
                      Disable notifications during specific hours
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handlePreferenceChange('quietHours', {
                    ...preferences.quietHours,
                    enabled: !preferences.quietHours.enabled
                  })}
                  className={`
                    relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                    ${preferences.quietHours.enabled ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                      ${preferences.quietHours.enabled ? 'translate-x-5' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {preferences.quietHours.enabled && (
                <div className="flex items-center space-x-4 ml-8">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">From</label>
                    <input
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) => handlePreferenceChange('quietHours', {
                        ...preferences.quietHours,
                        start: e.target.value
                      })}
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">To</label>
                    <input
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) => handlePreferenceChange('quietHours', {
                        ...preferences.quietHours,
                        end: e.target.value
                      })}
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}