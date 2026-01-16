'use client'

import { memo } from 'react'
import { List } from 'react-window'

interface Project {
  id: string
  name: string
  health: 'green' | 'yellow' | 'red'
  status: string
  budget?: number
}

interface VirtualizedProjectSelectorProps {
  projects: Project[]
  selectedProject: Project | null
  onSelectProject: (project: Project) => void
  formatCurrency: (amount: number) => string
  height?: number
  itemHeight?: number
}

interface RowProps {
  project: Project
  selectedProject: Project | null
  onSelectProject: (project: Project) => void
  formatCurrency: (amount: number) => string
}

const VirtualizedProjectSelector = memo(function VirtualizedProjectSelector({
  projects,
  selectedProject,
  onSelectProject,
  formatCurrency,
  height = 400,
  itemHeight = 80
}: VirtualizedProjectSelectorProps) {
  // Row component for react-window
  const RowComponent = ({ project, selectedProject, onSelectProject, formatCurrency }: RowProps) => {
    return (
      <div className="px-3 py-1.5">
        <div
          onClick={() => onSelectProject(project)}
          className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            selectedProject?.id === project.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                project.health === 'green' ? 'bg-green-500' :
                project.health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <div>
                <h4 className="font-medium text-gray-900">{project.name}</h4>
                <p className="text-sm text-gray-500 capitalize">
                  {project.status.replace('-', ' ')}
                </p>
              </div>
            </div>
            {project.budget && (
              <span className="text-sm font-medium text-gray-600">
                {formatCurrency(project.budget)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Only use virtual scrolling for lists with more than 10 items
  if (projects.length <= 10) {
    return (
      <div className="space-y-3">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => onSelectProject(project)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              selectedProject?.id === project.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  project.health === 'green' ? 'bg-green-500' :
                  project.health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div>
                  <h4 className="font-medium text-gray-900">{project.name}</h4>
                  <p className="text-sm text-gray-500 capitalize">
                    {project.status.replace('-', ' ')}
                  </p>
                </div>
              </div>
              {project.budget && (
                <span className="text-sm font-medium text-gray-600">
                  {formatCurrency(project.budget)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <List
      defaultHeight={height}
      rowCount={projects.length}
      rowHeight={itemHeight}
      rowComponent={RowComponent}
      rowProps={(index) => ({
        project: projects[index],
        selectedProject,
        onSelectProject,
        formatCurrency
      })}
    />
  )
})

export default VirtualizedProjectSelector
