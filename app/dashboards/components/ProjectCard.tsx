'use client'

import { memo } from 'react'

interface Project {
  id: string
  name: string
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  actual_cost?: number | null
  created_at?: string
}

interface ProjectCardProps {
  project: Project
}

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div 
            className={`w-3 h-3 rounded-full flex-shrink-0 ${
              project.health === 'green' ? 'bg-green-500' :
              project.health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
            }`}
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {project.name || 'Unknown Project'}
            </h4>
            <p className="text-sm text-gray-500 capitalize">
              {project.status?.replace('-', ' ') || 'Unknown Status'}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {project.budget && (
            <p className="text-sm font-medium text-gray-900">
              ${project.budget.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-gray-500">
            {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Unknown Date'}
          </p>
        </div>
      </div>
    </div>
  )
}

// Custom comparison function to prevent unnecessary re-renders
// Only re-render if project data actually changes
const arePropsEqual = (prevProps: ProjectCardProps, nextProps: ProjectCardProps) => {
  const prev = prevProps.project
  const next = nextProps.project
  
  return (
    prev.id === next.id &&
    prev.name === next.name &&
    prev.status === next.status &&
    prev.health === next.health &&
    prev.budget === next.budget &&
    prev.actual_cost === next.actual_cost &&
    prev.created_at === next.created_at
  )
}

export default memo(ProjectCard, arePropsEqual)
