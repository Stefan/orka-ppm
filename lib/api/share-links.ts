/**
 * API client for shareable project URLs
 */

import { get, post, put, del } from '@/lib/api'
import type {
  ShareLink,
  ShareLinkListResponse,
  CreateShareLinkRequest,
  ShareAnalytics
} from '@/types/share-links'

/**
 * Create a new share link for a project
 */
export async function createShareLink(
  projectId: string,
  data: Omit<CreateShareLinkRequest, 'project_id'>
) {
  return post<ShareLink>(`/api/projects/${projectId}/shares`, {
    ...data,
    project_id: projectId
  })
}

/**
 * Get all share links for a project
 */
export async function getProjectShareLinks(projectId: string) {
  return get<ShareLinkListResponse>(`/api/projects/${projectId}/shares`)
}

/**
 * Revoke a share link
 */
export async function revokeShareLink(shareId: string) {
  return del<{ success: boolean }>(`/api/shares/${shareId}`)
}

/**
 * Extend the expiry of a share link
 */
export async function extendShareExpiry(shareId: string, newExpiry: string) {
  return put<ShareLink>(`/api/shares/${shareId}/extend`, {
    new_expiry: newExpiry
  })
}

/**
 * Get analytics for a share link
 */
export async function getShareAnalytics(shareId: string) {
  return get<ShareAnalytics>(`/api/shares/${shareId}/analytics`)
}

/**
 * Access a shared project using a token (public endpoint, no auth required)
 */
export async function accessSharedProject(projectId: string, token: string) {
  // This is a public endpoint, so we don't use the authenticated API client
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || ''}/api/projects/${projectId}/share/${token}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to access shared project')
  }
  
  return response.json()
}

/**
 * Copy share URL to clipboard
 */
export async function copyShareUrlToClipboard(shareUrl: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareUrl)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      textArea.remove()
      return success
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Generate email template for sharing a link
 */
export function generateShareEmailTemplate(
  shareLink: ShareLink,
  projectName: string
): string {
  const permissionDescriptions = {
    view_only: 'view basic project information (name, description, status, progress)',
    limited_data: 'view project milestones, timeline, and public documents',
    full_project: 'view comprehensive project data (excluding sensitive financial details)'
  }

  const expiryDate = new Date(shareLink.expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `Subject: Shared Project Access - ${projectName}

Hello,

You have been granted access to view the project "${projectName}".

Access Link: ${shareLink.share_url}

Permission Level: ${shareLink.permission_level.replace('_', ' ').toUpperCase()}
You can ${permissionDescriptions[shareLink.permission_level]}.

${shareLink.custom_message ? `\nMessage:\n${shareLink.custom_message}\n` : ''}
This link will expire on ${expiryDate}.

Please bookmark this link for future access. If you have any questions or need extended access, please contact the project manager.

Best regards,
Project Management Team`
}
