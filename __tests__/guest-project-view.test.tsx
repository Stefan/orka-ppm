/**
 * Unit Tests: GuestProjectView Component
 * 
 * Feature: shareable-project-urls
 * Task: 8.3 Write unit tests for guest interface
 * 
 * Tests:
 * - Responsive design across device sizes
 * - Permission-based content visibility
 * - Error handling and user experience
 * 
 * Validates: Requirements 5.1, 5.2, 5.5
 */

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import GuestProjectView from '@/components/projects/GuestProjectView'
import type { FilteredProjectData, SharePermissionLevel } from '@/types/share-links'

describe('GuestProjectView - Unit Tests', () => {
  const mockProjectData: FilteredProjectData = {
    id: 'project-123',
    name: 'Construction Project Alpha',
    description: 'A major construction project for building infrastructure',
    status: 'active',
    progress_percentage: 65,
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    milestones: [
      {
        id: 'milestone-1',
        name: 'Foundation Complete',
        due_date: '2024-03-15',
        status: 'completed',
        description: 'Foundation work completed successfully'
      },
      {
        id: 'milestone-2',
        name: 'Structural Framework',
        due_date: '2024-06-30',
        status: 'in_progress',
        description: 'Building structural framework'
      }
    ],
    team_members: [
      {
        id: 'user-1',
        name: 'John Doe',
        role: 'Project Manager',
        email: 'john@example.com'
      },
      {
        id: 'user-2',
        name: 'Jane Smith',
        role: 'Lead Engineer',
        email: 'jane@example.com'
      }
    ],
    documents: [
      {
        id: 'doc-1',
        name: 'Project Plan.pdf',
        type: 'PDF',
        uploaded_at: '2024-01-15',
        size: 2048000
      },
      {
        id: 'doc-2',
        name: 'Blueprint.dwg',
        type: 'DWG',
        uploaded_at: '2024-02-01',
        size: 5120000
      }
    ],
    timeline: {
      phases: [
        {
          name: 'Planning Phase',
          start_date: '2024-01-01',
          end_date: '2024-02-28',
          status: 'completed'
        },
        {
          name: 'Construction Phase',
          start_date: '2024-03-01',
          end_date: '2024-10-31',
          status: 'in_progress'
        }
      ]
    }
  }

  afterEach(() => {
    cleanup()
  })

  describe('Basic Rendering - Req 5.1', () => {
    test('should render project name and description', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      expect(screen.getByText('Construction Project Alpha')).toBeInTheDocument()
      expect(screen.getByText('A major construction project for building infrastructure')).toBeInTheDocument()
    })

    test('should render project status badge', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      expect(screen.getByText('active')).toBeInTheDocument()
    })

    test('should render progress bar with percentage', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      expect(screen.getByText('65%')).toBeInTheDocument()
      expect(screen.getByText('Progress')).toBeInTheDocument()
    })

    test('should render start and end dates', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      expect(screen.getByText('Start Date')).toBeInTheDocument()
      expect(screen.getByText('End Date')).toBeInTheDocument()
    })

    test('should render custom message when provided', () => {
      const customMessage = 'Welcome to our project! Please review the latest updates.'
      
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
          customMessage={customMessage}
        />
      )

      expect(screen.getByText(/Welcome to our project/)).toBeInTheDocument()
    })

    test('should not render custom message when not provided', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      expect(screen.queryByText(/Message from project manager/)).not.toBeInTheDocument()
    })
  })

  describe('Permission-Based Content Visibility - Req 5.2', () => {
    test('VIEW_ONLY: should only show basic project information', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      // Should show basic info
      expect(screen.getByText('Construction Project Alpha')).toBeInTheDocument()
      expect(screen.getByText('65%')).toBeInTheDocument()

      // Should NOT show milestones, team, documents, or timeline
      expect(screen.queryByText('Milestones')).not.toBeInTheDocument()
      expect(screen.queryByText('Team Members')).not.toBeInTheDocument()
      expect(screen.queryByText('Documents')).not.toBeInTheDocument()
      expect(screen.queryByText('Project Timeline')).not.toBeInTheDocument()
    })

    test('LIMITED_DATA: should show milestones, timeline, and documents', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )

      // Should show basic info
      expect(screen.getByText('Construction Project Alpha')).toBeInTheDocument()

      // Should show additional content
      expect(screen.getByText('Milestones')).toBeInTheDocument()
      expect(screen.getByText('Foundation Complete')).toBeInTheDocument()
      expect(screen.getByText('Team Members')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Project Plan.pdf')).toBeInTheDocument()
      expect(screen.getByText('Project Timeline')).toBeInTheDocument()
      expect(screen.getByText('Planning Phase')).toBeInTheDocument()
    })

    test('FULL_PROJECT: should show all available content', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="full_project"
        />
      )

      // Should show all content
      expect(screen.getByText('Construction Project Alpha')).toBeInTheDocument()
      expect(screen.getByText('Milestones')).toBeInTheDocument()
      expect(screen.getByText('Team Members')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Project Timeline')).toBeInTheDocument()
    })

    test('should display correct access level badge', () => {
      const { rerender } = render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      expect(screen.getByText('View Only')).toBeInTheDocument()
      expect(screen.getByText('Basic project information')).toBeInTheDocument()

      rerender(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('Limited Data')).toBeInTheDocument()
      expect(screen.getByText('Milestones, timeline & documents')).toBeInTheDocument()

      rerender(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="full_project"
        />
      )

      expect(screen.getByText('Full Project')).toBeInTheDocument()
      expect(screen.getByText('Comprehensive project data')).toBeInTheDocument()
    })
  })

  describe('Responsive Design - Req 5.5', () => {
    test('should render mobile-friendly layout structure', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )

      // Check for responsive grid classes by finding the main element
      const { container } = render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )
      const mainElement = container.querySelector('main')
      expect(mainElement).toBeInTheDocument()
    })

    test('should render header with logo and project name', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      expect(screen.getByText('Construction Project Alpha')).toBeInTheDocument()
      expect(screen.getByText('Shared Project View')).toBeInTheDocument()
    })

    test('should render footer with contact information', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      expect(screen.getByText(/This is a shared project view/)).toBeInTheDocument()
      expect(screen.getByText(/contact the project manager/)).toBeInTheDocument()
    })
  })

  describe('Data Formatting', () => {
    test('should format dates correctly', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      // Dates should be formatted as "Jan 1, 2024" format
      expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument()
      expect(screen.getByText(/Dec 31, 2024/)).toBeInTheDocument()
    })

    test('should handle missing dates gracefully', () => {
      const projectWithoutDates: FilteredProjectData = {
        ...mockProjectData,
        start_date: undefined,
        end_date: undefined
      }

      render(
        <GuestProjectView
          projectData={projectWithoutDates}
          permissionLevel="view_only"
        />
      )

      expect(screen.getAllByText('Not set')).toHaveLength(2)
    })

    test('should format file sizes correctly', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )

      // Check that documents section is rendered
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Project Plan.pdf')).toBeInTheDocument()
      expect(screen.getByText('Blueprint.dwg')).toBeInTheDocument()
    })

    test('should handle missing progress percentage', () => {
      const projectWithoutProgress: FilteredProjectData = {
        ...mockProjectData,
        progress_percentage: undefined
      }

      render(
        <GuestProjectView
          projectData={projectWithoutProgress}
          permissionLevel="view_only"
        />
      )

      // Progress section should not be rendered
      expect(screen.queryByText('Progress')).not.toBeInTheDocument()
    })
  })

  describe('Empty State Handling', () => {
    test('should show empty state for milestones when none exist', () => {
      const projectWithoutMilestones: FilteredProjectData = {
        ...mockProjectData,
        milestones: []
      }

      render(
        <GuestProjectView
          projectData={projectWithoutMilestones}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('No milestones available')).toBeInTheDocument()
    })

    test('should show empty state for team members when none exist', () => {
      const projectWithoutTeam: FilteredProjectData = {
        ...mockProjectData,
        team_members: []
      }

      render(
        <GuestProjectView
          projectData={projectWithoutTeam}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('No team members listed')).toBeInTheDocument()
    })

    test('should show empty state for documents when none exist', () => {
      const projectWithoutDocs: FilteredProjectData = {
        ...mockProjectData,
        documents: []
      }

      render(
        <GuestProjectView
          projectData={projectWithoutDocs}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('No documents available')).toBeInTheDocument()
    })

    test('should show empty state for timeline when no phases exist', () => {
      const projectWithoutTimeline: FilteredProjectData = {
        ...mockProjectData,
        timeline: {
          phases: []
        }
      }

      render(
        <GuestProjectView
          projectData={projectWithoutTimeline}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('No timeline phases available')).toBeInTheDocument()
    })
  })

  describe('Status Indicators', () => {
    test('should render milestone status icons correctly', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )

      // Check that milestones are rendered with their statuses
      expect(screen.getByText('Foundation Complete')).toBeInTheDocument()
      expect(screen.getByText('Structural Framework')).toBeInTheDocument()
    })

    test('should apply correct status colors', () => {
      const projectWithVariousStatuses: FilteredProjectData = {
        ...mockProjectData,
        milestones: [
          {
            id: 'm1',
            name: 'Completed Milestone',
            due_date: '2024-03-15',
            status: 'completed'
          },
          {
            id: 'm2',
            name: 'At Risk Milestone',
            due_date: '2024-06-30',
            status: 'at_risk'
          },
          {
            id: 'm3',
            name: 'In Progress Milestone',
            due_date: '2024-09-15',
            status: 'in_progress'
          }
        ]
      }

      render(
        <GuestProjectView
          projectData={projectWithVariousStatuses}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('Completed Milestone')).toBeInTheDocument()
      expect(screen.getByText('At Risk Milestone')).toBeInTheDocument()
      expect(screen.getByText('In Progress Milestone')).toBeInTheDocument()
    })
  })

  describe('Team Member Display', () => {
    test('should render team member avatars with initials', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Project Manager')).toBeInTheDocument()
      expect(screen.getByText('Lead Engineer')).toBeInTheDocument()
    })

    test('should display team member emails when available', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('john@example.com')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    })

    test('should handle team members without emails', () => {
      const projectWithoutEmails: FilteredProjectData = {
        ...mockProjectData,
        team_members: [
          {
            id: 'user-1',
            name: 'John Doe',
            role: 'Project Manager'
          }
        ]
      }

      render(
        <GuestProjectView
          projectData={projectWithoutEmails}
          permissionLevel="limited_data"
        />
      )

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Project Manager')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should have proper heading hierarchy', () => {
      render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="limited_data"
        />
      )

      // Main heading
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('Construction Project Alpha')
    })

    test('should have semantic HTML structure', () => {
      const { container } = render(
        <GuestProjectView
          projectData={mockProjectData}
          permissionLevel="view_only"
        />
      )

      // Check for semantic elements
      expect(container.querySelector('header')).toBeInTheDocument()
      expect(container.querySelector('main')).toBeInTheDocument()
      expect(container.querySelector('footer')).toBeInTheDocument()
    })
  })
})
