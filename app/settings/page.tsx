'use client'

import { useState } from 'react'
import AppLayout from '@/components/shared/AppLayout'
import { useTranslations } from '@/lib/i18n/context'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Settings, Palette, LayoutDashboard, Bell, Shield } from 'lucide-react'
import { GeneralSettings, DashboardSettings, PrivacySettings } from './components'
import NotificationSettings from '@/components/notifications/NotificationSettings'

export default function SettingsPage() {
  const { t } = useTranslations()
  const [activeTab, setActiveTab] = useState('general')

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-gray-600 dark:text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {t('settings.title') || 'Settings'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t('settings.description') || 'Manage your preferences and application settings'}
            </p>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 bg-background-tertiary p-2 rounded-xl">
            <TabsTrigger 
              value="general" 
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 px-3 rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 text-gray-700 dark:text-slate-300"
            >
              <Palette className="h-5 w-5" />
              <span className="text-xs sm:text-sm font-medium">{t('settings.general') || 'General'}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="dashboard"
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 px-3 rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 text-gray-700 dark:text-slate-300"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-xs sm:text-sm font-medium">{t('settings.dashboard') || 'Dashboard'}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notifications"
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 px-3 rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 text-gray-700 dark:text-slate-300"
            >
              <Bell className="h-5 w-5" />
              <span className="text-xs sm:text-sm font-medium">{t('settings.notifications') || 'Notifications'}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="privacy"
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 px-3 rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 text-gray-700 dark:text-slate-300"
            >
              <Shield className="h-5 w-5" />
              <span className="text-xs sm:text-sm font-medium">{t('settings.privacy') || 'Privacy'}</span>
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {t('settings.generalTitle') || 'General Settings'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t('settings.generalDescription') || 'Customize your appearance and language preferences'}
                </p>
              </CardHeader>
              <CardContent>
                <GeneralSettings />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dashboard Settings Tab */}
          <TabsContent value="dashboard">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {t('settings.dashboardTitle') || 'Dashboard Settings'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t('settings.dashboardDescription') || 'Configure KPI calculations and dashboard layout'}
                </p>
              </CardHeader>
              <CardContent>
                <DashboardSettings />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {t('settings.notificationsTitle') || 'Notification Settings'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t('settings.notificationsDescription') || 'Manage how you receive notifications'}
                </p>
              </CardHeader>
              <CardContent>
                <NotificationSettings />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Settings Tab */}
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {t('settings.privacyTitle') || 'Privacy & AI Settings'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t('settings.privacyDescription') || 'Control AI features and data preferences'}
                </p>
              </CardHeader>
              <CardContent>
                <PrivacySettings />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
