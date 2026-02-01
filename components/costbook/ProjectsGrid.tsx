'use client'

import React from 'react'
import { ProjectWithFinancials, Currency } from '@/types/costbook'
import { ProjectCard, ProjectRow } from './ProjectCard'
import { AnomalyResult, getAnomaliesForProject } from '@/lib/costbook/anomaly-detection'
import { LayoutGrid, List, Search } from 'lucide-react'

export interface ProjectsGridProps {
  /** Array of projects to display */
  projects: ProjectWithFinancials[]
  /** Currency for formatting */
  currency: Currency
  /** Currently selected project ID */
  selectedProjectId?: string
  /** Handler for project selection */
  onProjectSelect?: (project: ProjectWithFinancials) => void
  /** View mode */
  viewMode?: 'grid' | 'list'
  /** Filter/search term */
  searchTerm?: string
  /** Loading state */
  isLoading?: boolean
  /** Anomalies data */
  anomalies?: AnomalyResult[]
  /** Handler for anomaly clicks */
  onAnomalyClick?: (anomaly: AnomalyResult) => void
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * Empty state component
 */
function EmptyState({ searchTerm }: { searchTerm?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <Search className="w-12 h-12 mb-4 opacity-50" />
      <h3 className="text-lg font-medium mb-1">No projects found</h3>
      <p className="text-sm">
        {searchTerm 
          ? `No projects match "${searchTerm}"`
          : 'Get started by creating your first project'
        }
      </p>
    </div>
  )
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  const skeletonCount = viewMode === 'grid' ? 6 : 4

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div 
            key={i} 
            className="h-14 bg-gray-100 rounded animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div 
          key={i} 
          className="h-48 bg-gray-100 rounded-lg animate-pulse"
        />
      ))}
    </div>
  )
}

/**
 * List view header
 */
function ListHeader() {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
      <div className="flex-1">Project</div>
      <div className="flex items-center gap-6">
        <span className="w-24 text-right">Budget</span>
        <span className="w-24 text-right">Spend</span>
        <span className="w-24 text-right">Variance</span>
        <span className="w-16 text-right">%</span>
      </div>
    </div>
  )
}

/**
 * View mode toggle buttons
 */
export function ViewModeToggle({
  viewMode,
  onViewModeChange,
  className = ''
}: {
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  className?: string
}) {
  return (
    <div className={`flex rounded-md shadow-sm ${className}`}>
      <button
        onClick={() => onViewModeChange('grid')}
        className={`
          flex items-center justify-center
          px-3 py-2
          border border-gray-300
          rounded-l-md
          text-sm font-medium
          transition-colors
          ${viewMode === 'grid' 
            ? 'bg-blue-50 text-blue-600 border-blue-300' 
            : 'bg-white text-gray-700 hover:bg-gray-50'
          }
        `}
        title="Grid view"
        aria-pressed={viewMode === 'grid'}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => onViewModeChange('list')}
        className={`
          flex items-center justify-center
          px-3 py-2
          border border-l-0 border-gray-300
          rounded-r-md
          text-sm font-medium
          transition-colors
          ${viewMode === 'list' 
            ? 'bg-blue-50 text-blue-600 border-blue-300' 
            : 'bg-white text-gray-700 hover:bg-gray-50'
          }
        `}
        title="List view"
        aria-pressed={viewMode === 'list'}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  )
}

/**
 * ProjectsGrid component for Costbook
 * Displays projects in a responsive grid or list layout
 */
export function ProjectsGrid({
  projects,
  currency,
  selectedProjectId,
  onProjectSelect,
  viewMode = 'grid',
  searchTerm,
  isLoading = false,
  anomalies = [],
  onAnomalyClick,
  className = '',
  'data-testid': testId = 'projects-grid'
}: ProjectsGridProps) {
  // Filter projects by search term
  const filteredProjects = searchTerm
    ? projects.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.project_manager?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : projects

  if (isLoading) {
    return (
      <div className={className} data-testid={`${testId}-loading`}>
        <LoadingSkeleton viewMode={viewMode} />
      </div>
    )
  }

  if (filteredProjects.length === 0) {
    return (
      <div className={className} data-testid={`${testId}-empty`}>
        <EmptyState searchTerm={searchTerm} />
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div
        className={`
          bg-white
          rounded-lg
          shadow-md
          overflow-hidden
          ${className}
        `}
        data-testid={testId}
      >
        <ListHeader />
        <div className="overflow-y-auto">
          {filteredProjects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              currency={currency}
              onClick={onProjectSelect}
              anomalies={getAnomaliesForProject(project.id, anomalies)}
              onAnomalyClick={onAnomalyClick}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`
        grid
        grid-cols-1
        sm:grid-cols-2
        md:grid-cols-3
        lg:grid-cols-4
        xl:grid-cols-5
        2xl:grid-cols-6
        gap-6
        overflow-y-auto
        ${className}
      `}
      data-testid={testId}
      role="list"
      aria-label="Projects"
    >
      {filteredProjects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          currency={currency}
          onClick={onProjectSelect}
          selected={selectedProjectId === project.id}
          anomalies={getAnomaliesForProject(project.id, anomalies)}
          onAnomalyClick={onAnomalyClick}
          data-testid={`${testId}-card-${project.id}`}
        />
      ))}
    </div>
  )
}

export default ProjectsGrid