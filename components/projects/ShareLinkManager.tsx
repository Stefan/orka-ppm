/**
 * ShareLinkManager Component
 * 
 * Manages shareable project URLs with permission and expiry controls.
 * Provides UI for creating, viewing, and managing share links.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Copy, Trash2, Clock, Mail, ExternalLink, AlertCircle, CheckCircle, BarChart3, Eye, Users, TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/design-system'
import {
  createShareLink,
  getProjectShareLinks,
  revokeShareLink,
  extendShareExpiry,
  copyShareUrlToClipboard,
  generateShareEmailTemplate
} from '@/lib/api/share-links'
import type { ShareLink, SharePermissionLevel, ShareLinkFormData } from '@/types/share-links'
import ShareAnalyticsDashboard from './ShareAnalyticsDashboard'

interface ShareLinkManagerProps {
  projectId: string
  projectName: string
  userPermissions: string[]
}

/**
 * ShareLinkManager Component
 */
export const ShareLinkManager: React.FC<ShareLinkManagerProps> = ({
  projectId,
  projectName,
  userPermissions
}) => {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedLinkForAnalytics, setSelectedLinkForAnalytics] = useState<string | null>(null)
  const [showAnalyticsSummary, setShowAnalyticsSummary] = useState(true)
  
  // Form state
  const [formData, setFormData] = useState<ShareLinkFormData>({
    permission_level: 'view_only' as SharePermissionLevel,
    expiry_duration_days: 7,
    custom_message: ''
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ShareLinkFormData, string>>>({})

  // Load share links on mount
  useEffect(() => {
    loadShareLinks()
  }, [projectId])

  /**
   * Load all share links for the project
   */
  const loadShareLinks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getProjectShareLinks(projectId)
      setShareLinks(response.data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load share links')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ShareLinkFormData, string>> = {}

    if (!formData.permission_level) {
      errors.permission_level = 'Permission level is required'
    }

    if (!formData.expiry_duration_days || formData.expiry_duration_days < 1) {
      errors.expiry_duration_days = 'Expiry duration must be at least 1 day'
    }

    if (formData.expiry_duration_days > 365) {
      errors.expiry_duration_days = 'Expiry duration cannot exceed 365 days'
    }

    if (formData.custom_message && formData.custom_message.length > 500) {
      errors.custom_message = 'Message cannot exceed 500 characters'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * Handle form submission to create a new share link
   */
  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const response = await createShareLink(projectId, {
        permission_level: formData.permission_level,
        expiry_duration_days: formData.expiry_duration_days,
        custom_message: formData.custom_message || undefined
      })

      setSuccess('Share link created successfully!')
      setShowCreateForm(false)
      setFormData({
        permission_level: 'view_only' as SharePermissionLevel,
        expiry_duration_days: 7,
        custom_message: ''
      })
      
      // Reload share links
      await loadShareLinks()
    } catch (err: any) {
      setError(err.message || 'Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle revoking a share link
   */
  const handleRevokeLink = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this share link? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      await revokeShareLink(shareId)
      setSuccess('Share link revoked successfully')
      
      // Reload share links
      await loadShareLinks()
    } catch (err: any) {
      setError(err.message || 'Failed to revoke share link')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle copying share URL to clipboard
   */
  const handleCopyUrl = async (shareUrl: string) => {
    const success = await copyShareUrlToClipboard(shareUrl)
    if (success) {
      setSuccess('Share URL copied to clipboard!')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError('Failed to copy URL to clipboard')
    }
  }

  /**
   * Handle generating email template
   */
  const handleGenerateEmail = (shareLink: ShareLink) => {
    const emailTemplate = generateShareEmailTemplate(shareLink, projectName)
    const mailtoLink = `mailto:?subject=${encodeURIComponent(`Shared Project Access - ${projectName}`)}&body=${encodeURIComponent(emailTemplate)}`
    window.location.href = mailtoLink
  }

  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /**
   * Check if link is expiring soon (within 24 hours)
   */
  const isExpiringSoon = (expiryDate: string): boolean => {
    const expiry = new Date(expiryDate)
    const now = new Date()
    const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntilExpiry > 0 && hoursUntilExpiry <= 24
  }

  /**
   * Check if link is expired
   */
  const isExpired = (expiryDate: string): boolean => {
    return new Date(expiryDate) < new Date()
  }

  /**
   * Get permission level display name
   */
  const getPermissionDisplayName = (level: SharePermissionLevel): string => {
    const names = {
      view_only: 'View Only',
      limited_data: 'Limited Data',
      full_project: 'Full Project'
    }
    return names[level] || level
  }

  /**
   * Get permission level description
   */
  const getPermissionDescription = (level: SharePermissionLevel): string => {
    const descriptions = {
      view_only: 'Basic project info (name, description, status, progress)',
      limited_data: 'Includes milestones, timeline, and public documents',
      full_project: 'All project data (excluding sensitive financial details)'
    }
    return descriptions[level] || ''
  }

  // Permission options for the select dropdown
  const permissionOptions = [
    { value: 'view_only', label: 'View Only - Basic Information' },
    { value: 'limited_data', label: 'Limited Data - Milestones & Timeline' },
    { value: 'full_project', label: 'Full Project - Comprehensive Access' }
  ]

  // Expiry duration options
  const expiryOptions = [
    { value: '1', label: '1 Day' },
    { value: '7', label: '1 Week' },
    { value: '30', label: '1 Month' },
    { value: '90', label: '3 Months' },
    { value: '180', label: '6 Months' },
    { value: '365', label: '1 Year' }
  ]

  return (
    <div className="space-y-6">
      {/* Show full analytics dashboard if a link is selected */}
      {selectedLinkForAnalytics ? (
        <div>
          <Button
            variant="secondary"
            onClick={() => setSelectedLinkForAnalytics(null)}
            className="mb-4"
          >
            ← Back to Share Links
          </Button>
          <ShareAnalyticsDashboard
            shareId={selectedLinkForAnalytics}
            projectId={projectId}
            onRefresh={loadShareLinks}
          />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Share Links</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Create and manage shareable links for external stakeholders
              </p>
            </div>
            {!showCreateForm && (
              <Button
                variant="primary"
                onClick={() => setShowCreateForm(true)}
                disabled={loading}
              >
                Create Share Link
              </Button>
            )}
          </div>

          {/* Analytics Summary Widget */}
          {shareLinks.length > 0 && showAnalyticsSummary && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Quick Insights
                    </CardTitle>
                    <CardDescription>
                      Summary of share link activity across all links
                    </CardDescription>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAnalyticsSummary(false)}
                  >
                    Hide
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Accesses</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {shareLinks.reduce((sum, link) => sum + link.access_count, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <ExternalLink className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Active Links</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {shareLinks.filter(link => link.is_active && !isExpired(link.expires_at)).length}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Most Active</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {Math.max(...shareLinks.map(link => link.access_count), 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!showAnalyticsSummary && shareLinks.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAnalyticsSummary(true)}
            >
              Show Analytics Summary
            </Button>
          )}

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Create Share Link Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Share Link</CardTitle>
            <CardDescription>
              Generate a secure link to share project information with external stakeholders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateShareLink} className="space-y-4">
              {/* Permission Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Permission Level *
                </label>
                <Select
                  options={permissionOptions}
                  value={formData.permission_level}
                  onChange={(value) => setFormData({ ...formData, permission_level: value as SharePermissionLevel })}
                  error={formErrors.permission_level}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {getPermissionDescription(formData.permission_level)}
                </p>
              </div>

              {/* Expiry Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Expiry Duration *
                </label>
                <Select
                  options={expiryOptions}
                  value={formData.expiry_duration_days.toString()}
                  onChange={(value) => setFormData({ ...formData, expiry_duration_days: parseInt(value) })}
                  error={formErrors.expiry_duration_days}
                />
              </div>

              {/* Custom Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Custom Message (Optional)
                </label>
                <Textarea
                  value={formData.custom_message}
                  onChange={(value) => setFormData({ ...formData, custom_message: value })}
                  placeholder="Add a custom message for the recipient..."
                  rows={3}
                  error={formErrors.custom_message}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {formData.custom_message.length}/500 characters
                </p>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateForm(false)
                setFormErrors({})
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateShareLink}
              loading={loading}
              disabled={loading}
            >
              Create Share Link
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Active Share Links List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          Active Share Links ({shareLinks.filter(link => link.is_active && !isExpired(link.expires_at)).length})
        </h3>

        {loading && shareLinks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500 dark:text-slate-400">
              Loading share links...
            </CardContent>
          </Card>
        ) : shareLinks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500 dark:text-slate-400">
              No share links created yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          shareLinks.map((link) => {
            const expired = isExpired(link.expires_at)
            const expiringSoon = isExpiringSoon(link.expires_at)

            return (
              <Card
                key={link.id}
                className={cn(
                  expired && 'opacity-60 bg-gray-50 dark:bg-slate-800/50'
                )}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Link Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          link.permission_level === 'view_only' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
                          link.permission_level === 'limited_data' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
                          link.permission_level === 'full_project' && 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        )}>
                          {getPermissionDisplayName(link.permission_level)}
                        </span>
                        {expired && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                            Expired
                          </span>
                        )}
                        {!expired && expiringSoon && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                            <Clock className="h-3 w-3 mr-1" />
                            Expiring Soon
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 mb-1">
                        <ExternalLink className="h-4 w-4" />
                        <code className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded truncate max-w-md">
                          {link.share_url}
                        </code>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                        <span>Created: {formatDate(link.created_at)}</span>
                        <span>Expires: {formatDate(link.expires_at)}</span>
                        <span>Accesses: {link.access_count}</span>
                      </div>

                      {link.custom_message && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400 italic">
                          "{link.custom_message}"
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedLinkForAnalytics(link.id)}
                        disabled={loading}
                        title="View Analytics"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyUrl(link.share_url)}
                        disabled={expired || loading}
                        title="Copy URL"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleGenerateEmail(link)}
                        disabled={expired || loading}
                        title="Generate Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRevokeLink(link.id)}
                        disabled={loading}
                        title="Revoke Link"
                        className="text-red-600 dark:text-red-400 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
        </>
      )}
    </div>
  )
}

export default ShareLinkManager
