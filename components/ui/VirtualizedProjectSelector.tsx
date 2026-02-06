'use client'

import { memo, useState, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'

interface Project {
  id: string
  name: string
  health: 'green' | 'yellow' | 'red'
  status: string
  budget?: number | null
}

interface VirtualizedProjectSelectorProps {
  projects: Project[]
  selectedProject: Project | null
  onSelectProject?: (project: Project) => void
  formatCurrency: (amount: number) => string
  height?: number
  itemHeight?: number
}

const VirtualizedProjectSelector = memo(function VirtualizedProjectSelector({
  projects,
  selectedProject,
  onSelectProject,
  formatCurrency,
  height = 400,
  itemHeight = 80
}: VirtualizedProjectSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  
  // Filter out invalid projects
  const validProjects = projects.filter(p => p && p.id && p.name)
  
  // Filter projects based on search term
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return validProjects
    
    const search = searchTerm.toLowerCase()
    return validProjects.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.status.toLowerCase().includes(search)
    )
  }, [validProjects, searchTerm])
  
  // Show message if no valid projects
  if (validProjects.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-slate-400">
        <p>No projects available</p>
      </div>
    )
  }

  const handleSelectProject = (project: Project) => {
    onSelectProject?.(project)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className="relative">
      {/* Selected Project Display / Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 rounded-lg border-2 border-gray-200 dark:border-slate-700 hover:border-gray-300 transition-colors text-left bg-white dark:bg-slate-800"
      >
        {selectedProject ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                selectedProject.health === 'green' ? 'bg-green-500' :
                selectedProject.health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">{selectedProject.name}</h4>
                <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">
                  {selectedProject.status.replace('-', ' ')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 flex-shrink-0">
              {selectedProject.budget && (
                <span className="text-sm font-medium text-gray-600 dark:text-slate-400">
                  {formatCurrency(selectedProject.budget)}
                </span>
              )}
              <ChevronDown className={`h-5 w-5 text-gray-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-slate-400">Select a project...</span>
            <ChevronDown className={`h-5 w-5 text-gray-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-lg border-2 border-gray-200 dark:border-slate-700 shadow-lg">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                autoFocus
              />
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              {filteredProjects.length} of {validProjects.length} projects
            </div>
          </div>

          {/* Projects List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredProjects.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-slate-400 text-sm">
                No projects found matching "{searchTerm}"
              </div>
            ) : (
              <div className="p-2">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    className={`w-full p-3 rounded-lg transition-colors text-left ${
                      selectedProject?.id === project.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          project.health === 'green' ? 'bg-green-500' :
                          project.health === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">{project.name}</h4>
                          <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">
                            {project.status.replace('-', ' ')}
                          </p>
                        </div>
                      </div>
                      {project.budget && (
                        <span className="text-sm font-medium text-gray-600 dark:text-slate-400 flex-shrink-0 ml-3">
                          {formatCurrency(project.budget)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setIsOpen(false)
            setSearchTerm('')
          }}
        />
      )}
    </div>
  )
})

export default VirtualizedProjectSelector
