/**
 * Guest Project Access Page
 * 
 * Public route for external stakeholders to access shared project information.
 * Validates share token and displays filtered project data based on permissions.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, Clock, XCircle, Loader2 } from 'lucide-react'
import GuestProjectView from '@/components/projects/GuestProjectView'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import type { FilteredProjectData, SharePermissionLevel } from '@/types/share-links'

interface ShareAccessResponse {
  success: boolean
  project: FilteredProjectData
  permission_level: SharePermissionLevel
  custom_message?: string
  error?: string
  error_type?: 'invalid_token' | 'expired' | 'revoked' | 'not_found' | 'server_error'
}

/**
 * Guest Project Access Page
 */
export default function GuestProjectAccessPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params?.id as string
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{
    type: string
    message: string
  } | null>(null)
  const [projectData, setProjectData] = useState<FilteredProjectData | null>(null)
  const [permissionLevel, setPermissionLevel] = useState<SharePermissionLevel>('view_only')
  const [customMessage, setCustomMessage] = useState<string | undefined>()

  useEffect(() => {
    if (projectId && token) {
      fetchSharedProject()
    }
  }, [projectId, token])

  /**
   * Fetch shared project data using the token
   */
  const fetchSharedProject = async () => {
    try {
      setLoading(true)
      setError(null)

      // Call the guest access endpoint (no authentication required)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/projects/${projectId}/share/${token}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const data: ShareAccessResponse = await response.json()

      if (!response.ok || !data.success) {
        // Handle different error types
        const errorType = data.error_type || 'server_error'
        const errorMessage = data.error || 'Failed to access shared project'
        
        setError({
          type: errorType,
          message: errorMessage
        })
        return
      }

      // Successfully loaded project data
      setProjectData(data.project)
      setPermissionLevel(data.permission_level)
      setCustomMessage(data.custom_message)
    } catch (err) {
      console.error('Failed to fetch shared project:', err)
      setError({
        type: 'server_error',
        message: 'Unable to connect to the server. Please try again later.'
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Loading Project...
            </h2>
            <p className="text-sm text-gray-600">
              Please wait while we retrieve the shared project information.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            {/* Error Icon */}
            {error.type === 'expired' && (
              <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            )}
            {error.type === 'revoked' && (
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            )}
            {(error.type === 'invalid_token' || error.type === 'not_found') && (
              <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            )}
            {error.type === 'server_error' && (
              <AlertCircle className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            )}

            {/* Error Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {error.type === 'expired' && 'Link Expired'}
              {error.type === 'revoked' && 'Access Revoked'}
              {error.type === 'invalid_token' && 'Invalid Link'}
              {error.type === 'not_found' && 'Project Not Found'}
              {error.type === 'server_error' && 'Connection Error'}
            </h2>

            {/* Error Message */}
            <p className="text-gray-600 mb-6">
              {error.message}
            </p>

            {/* Error-specific guidance */}
            {error.type === 'expired' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-yellow-900">
                  <span className="font-medium">This share link has expired.</span>
                  <br />
                  Please contact the project manager to request a new link with extended access.
                </p>
              </div>
            )}

            {error.type === 'revoked' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-red-900">
                  <span className="font-medium">Access has been revoked.</span>
                  <br />
                  The project manager has disabled this share link. Please contact them if you need access.
                </p>
              </div>
            )}

            {(error.type === 'invalid_token' || error.type === 'not_found') && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-orange-900">
                  <span className="font-medium">This link is not valid.</span>
                  <br />
                  Please check that you have the correct URL or contact the project manager for assistance.
                </p>
              </div>
            )}

            {error.type === 'server_error' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Unable to connect to the server.</span>
                  <br />
                  Please check your internet connection and try again. If the problem persists, contact support.
                </p>
              </div>
            )}

            {/* Contact Information */}
            <div className="border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-600 mb-4">
                Need help? Contact the project manager or support team.
              </p>
              <Button
                variant="primary"
                onClick={() => fetchSharedProject()}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  /**
   * Render project view
   */
  if (projectData) {
    return (
      <GuestProjectView
        projectData={projectData}
        permissionLevel={permissionLevel}
        customMessage={customMessage}
      />
    )
  }

  /**
   * Fallback - should not reach here
   */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Unable to load the project. Please try again.
          </p>
          <Button
            variant="primary"
            onClick={() => router.push('/')}
            className="w-full"
          >
            Go to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
