'use client';

import { useState } from 'react';
import { Bell, BellOff, Settings, TestTube, Clock, Shield, AlertTriangle, Users, Monitor } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/context';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface NotificationSettingsProps {
  userId?: string;
  className?: string;
}

export default function NotificationSettings({ userId, className = '' }: NotificationSettingsProps) {
  const { t } = useTranslations();
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
      <div className={`p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg ${className}`}>
        <div className="flex items-center">
          <BellOff className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" aria-hidden />
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('settings.pushNotificationsNotSupported')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Main Toggle */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400 dark:text-slate-500" aria-hidden />
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {t('settings.pushNotifications')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {isSubscribed 
                  ? t('settings.pushNotificationsReceiveDesc')
                  : t('settings.pushNotificationsEnableDesc')
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Settings Button */}
            {isSubscribed && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" aria-hidden />
              </button>
            )}
            
            {/* Main Toggle */}
            <button
              onClick={handleToggleNotifications}
              disabled={isLoading || permission === 'denied'}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                ${isSubscribed ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'}
                ${isLoading || permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-200 transition-transform
                  ${isSubscribed ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>

        {/* Permission Denied Warning */}
        {permission === 'denied' && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-400 dark:text-red-500 mt-0.5 mr-2 flex-shrink-0" aria-hidden />
              <div>
                <h4 className="text-sm font-medium text-red-800 dark:text-red-300">
                  Notifications Blocked
                </h4>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  You've blocked notifications for this site. To enable them, click the lock icon in your browser's address bar and allow notifications.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-slate-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400 mr-2"></div>
            Setting up notifications...
          </div>
        )}
      </div>

      {/* Detailed Settings */}
      {showSettings && isSubscribed && (
        <div className="mt-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Notification Preferences
            </h4>
            <button
              onClick={handleTestNotification}
              disabled={isTestingNotification}
              className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors disabled:opacity-50"
            >
              <TestTube className={`w-4 h-4 mr-2 ${isTestingNotification ? 'animate-pulse' : ''}`} aria-hidden />
              {isTestingNotification ? 'Sending...' : 'Test Notification'}
            </button>
          </div>

          <div className="space-y-4">
            {/* Project Updates */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-blue-500 dark:text-blue-400" aria-hidden />
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    Project Updates
                  </label>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    Status changes, milestones, and progress updates
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePreferenceChange('projectUpdates', !preferences.projectUpdates)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${preferences.projectUpdates ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white dark:bg-slate-200 transition-transform
                    ${preferences.projectUpdates ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Risk Alerts */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" aria-hidden />
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    Risk Alerts
                  </label>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    High-priority risks and escalations
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePreferenceChange('riskAlerts', !preferences.riskAlerts)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${preferences.riskAlerts ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white dark:bg-slate-200 transition-transform
                    ${preferences.riskAlerts ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Resource Alerts */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-green-500 dark:text-green-400" aria-hidden />
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    Resource Alerts
                  </label>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    Resource conflicts and availability changes
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePreferenceChange('resourceAlerts', !preferences.resourceAlerts)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${preferences.resourceAlerts ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white dark:bg-slate-200 transition-transform
                    ${preferences.resourceAlerts ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* System Notifications */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Monitor className="w-5 h-5 text-gray-500 dark:text-slate-400" aria-hidden />
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    System Notifications
                  </label>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    Maintenance, updates, and system messages
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePreferenceChange('systemNotifications', !preferences.systemNotifications)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${preferences.systemNotifications ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white dark:bg-slate-200 transition-transform
                    ${preferences.systemNotifications ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Quiet Hours */}
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-purple-500 dark:text-purple-400" aria-hidden />
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      Quiet Hours
                    </label>
                    <p className="text-xs text-gray-600 dark:text-slate-400">
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
                    ${preferences.quietHours.enabled ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-3 w-3 transform rounded-full bg-white dark:bg-slate-200 transition-transform
                      ${preferences.quietHours.enabled ? 'translate-x-5' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {preferences.quietHours.enabled && (
                <div className="flex items-center space-x-4 ml-8">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">From</label>
                    <input
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) => handlePreferenceChange('quietHours', {
                        ...preferences.quietHours,
                        start: e.target.value
                      })}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">To</label>
                    <input
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) => handlePreferenceChange('quietHours', {
                        ...preferences.quietHours,
                        end: e.target.value
                      })}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-blue-400"
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