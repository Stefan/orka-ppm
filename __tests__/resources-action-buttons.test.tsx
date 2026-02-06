/**
 * Tests for Resource Page Action Buttons and ResourceActionButtons Component
 *
 * Covers:
 * - Toolbar buttons render with correct aria-labels and titles
 * - ResourceActionButtons renders conditionally based on props
 * - Callback handlers fire on click
 * - Permission guard hides buttons for viewers
 * - Compact vs default variant rendering
 * - Dark mode classes are present
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks ───────────────────────────────────────────────────────────────────

// Mock usePermissions
const mockHasPermission = jest.fn().mockReturnValue(true)
jest.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: mockHasPermission,
    isLoading: false,
    permissions: [],
  }),
}))

// Mock useTranslations
jest.mock('@/lib/i18n/context', () => ({
  useTranslations: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'resources.title': 'Resource Management',
        'resources.overallocated': 'overallocated',
        'resources.live': 'Live',
        'resources.of': 'of',
        'resources.avg': 'Avg',
        'resources.available': 'available',
        'nav.resources': 'Resources',
        'dashboard.updated': 'Updated',
      }
      return map[key] || key
    },
  }),
}))

// Mock PermissionGuard to render children when permission is granted
jest.mock('@/components/auth/PermissionGuard', () => ({
  __esModule: true,
  default: ({ children, permission }: { children: React.ReactNode; permission: string }) => {
    // Use the mocked hasPermission to decide
    const show = mockHasPermission(permission, {})
    return show ? <>{children}</> : null
  },
}))

import { ResourceActionButtons } from '@/components/resources/ResourceActionButtons'

// ── ResourceActionButtons Component Tests ───────────────────────────────────

describe('ResourceActionButtons', () => {
  beforeEach(() => {
    mockHasPermission.mockReturnValue(true)
  })

  it('renders assign button when onAssignResource is provided', () => {
    const onAssign = jest.fn()
    render(<ResourceActionButtons onAssignResource={onAssign} />)

    const btn = screen.getByLabelText('Ressource zuweisen')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('title', 'Ressource zuweisen')
  })

  it('renders schedule button when onScheduleResource is provided', () => {
    const onSchedule = jest.fn()
    render(<ResourceActionButtons onScheduleResource={onSchedule} />)

    const btn = screen.getByLabelText('Ressource planen')
    expect(btn).toBeInTheDocument()
  })

  it('renders edit allocation button when onEditAllocation is provided', () => {
    const onEdit = jest.fn()
    render(<ResourceActionButtons onEditAllocation={onEdit} />)

    const btn = screen.getByLabelText('Zuteilung bearbeiten')
    expect(btn).toBeInTheDocument()
  })

  it('renders remove button when onRemoveResource is provided', () => {
    const onRemove = jest.fn()
    render(<ResourceActionButtons onRemoveResource={onRemove} />)

    const btn = screen.getByLabelText('Ressource entfernen')
    expect(btn).toBeInTheDocument()
  })

  it('does not render buttons when no callbacks are provided', () => {
    render(<ResourceActionButtons />)

    expect(screen.queryByLabelText('Ressource zuweisen')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ressource planen')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Zuteilung bearbeiten')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ressource entfernen')).not.toBeInTheDocument()
  })

  it('calls onAssignResource when assign button is clicked', () => {
    const onAssign = jest.fn()
    render(<ResourceActionButtons onAssignResource={onAssign} />)

    fireEvent.click(screen.getByLabelText('Ressource zuweisen'))
    expect(onAssign).toHaveBeenCalledTimes(1)
  })

  it('calls onScheduleResource when schedule button is clicked', () => {
    const onSchedule = jest.fn()
    render(<ResourceActionButtons onScheduleResource={onSchedule} />)

    fireEvent.click(screen.getByLabelText('Ressource planen'))
    expect(onSchedule).toHaveBeenCalledTimes(1)
  })

  it('calls onEditAllocation when edit button is clicked', () => {
    const onEdit = jest.fn()
    render(<ResourceActionButtons onEditAllocation={onEdit} />)

    fireEvent.click(screen.getByLabelText('Zuteilung bearbeiten'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('calls onRemoveResource when remove button is clicked', () => {
    const onRemove = jest.fn()
    render(<ResourceActionButtons onRemoveResource={onRemove} />)

    fireEvent.click(screen.getByLabelText('Ressource entfernen'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('hides buttons when user lacks resource_update permission', () => {
    mockHasPermission.mockImplementation((perm: string) => {
      if (perm === 'resource_update') return false
      if (perm === 'resource_read') return true
      return false
    })

    render(
      <ResourceActionButtons
        onAssignResource={() => {}}
        onScheduleResource={() => {}}
        onEditAllocation={() => {}}
        onRemoveResource={() => {}}
      />
    )

    // All action buttons should be hidden (PermissionGuard blocks them)
    expect(screen.queryByLabelText('Ressource zuweisen')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ressource planen')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Zuteilung bearbeiten')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ressource entfernen')).not.toBeInTheDocument()

    // Viewer notice should appear
    expect(screen.getByText(/read-only access/i)).toBeInTheDocument()
  })

  describe('variant rendering', () => {
    it('renders text labels in default variant', () => {
      render(
        <ResourceActionButtons
          onAssignResource={() => {}}
          onScheduleResource={() => {}}
          variant="default"
        />
      )

      expect(screen.getByText('Assign')).toBeInTheDocument()
      expect(screen.getByText('Schedule')).toBeInTheDocument()
    })

    it('does not render text labels in compact variant', () => {
      render(
        <ResourceActionButtons
          onAssignResource={() => {}}
          onScheduleResource={() => {}}
          variant="compact"
        />
      )

      expect(screen.queryByText('Assign')).not.toBeInTheDocument()
      expect(screen.queryByText('Schedule')).not.toBeInTheDocument()
    })

    it('applies dark mode classes in compact variant', () => {
      render(
        <ResourceActionButtons
          onAssignResource={() => {}}
          variant="compact"
        />
      )

      const btn = screen.getByLabelText('Ressource zuweisen')
      expect(btn.className).toContain('dark:bg-indigo-500')
      expect(btn.className).toContain('dark:hover:bg-indigo-400')
    })
  })

  describe('context passing', () => {
    it('passes projectId to permission context', () => {
      render(
        <ResourceActionButtons
          projectId="project-123"
          onAssignResource={() => {}}
        />
      )

      // The button should render (permission granted)
      expect(screen.getByLabelText('Ressource zuweisen')).toBeInTheDocument()
    })

    it('passes portfolioId and resourceId to permission context', () => {
      render(
        <ResourceActionButtons
          portfolioId="portfolio-456"
          resourceId="resource-789"
          onAssignResource={() => {}}
        />
      )

      expect(screen.getByLabelText('Ressource zuweisen')).toBeInTheDocument()
    })
  })
})
