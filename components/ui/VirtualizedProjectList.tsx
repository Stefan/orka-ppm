'use client'

import { memo } from 'react'
import { List } from 'react-window'
import ProjectCard from '../../app/dashboards/components/ProjectCard'
import type { Project } from '../../lib/api/dashboard-loader'

interface VirtualizedProjectListProps {
  projects: Project[]
  height?: number
  itemHeight?: number
  className?: string
}

interface RowProps {
  project: Project
}

const VirtualizedProjectList = memo(function VirtualizedProjectList({
  projects,
  height = 600,
  itemHeight = 120,
  className = ''
}: VirtualizedProjectListProps) {
  // Row component for react-window
  const RowComponent = ({ project }: RowProps) => {
    return (
      <div className="px-2">
        <ProjectCard project={project} />
      </div>
    )
  }

  // Only use virtual scrolling for lists with more than 10 items
  if (projects.length <= 10) {
    return (
      <div className={`divide-y divide-gray-200 dark:divide-slate-700 ${className}`}>
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
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
      rowProps={(index) => ({ project: projects[index] })}
      className={className}
    />
  )
})

export default VirtualizedProjectList
