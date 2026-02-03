'use client'

import { memo } from 'react'
import { MapPin } from 'lucide-react'

interface Resource {
  id: string
  name: string
  email: string
  role?: string | null
  capacity: number
  availability: number
  hourly_rate?: number | null
  skills: string[]
  location?: string | null
  current_projects: string[]
  utilization_percentage: number
  available_hours: number
  allocated_hours: number
  capacity_hours: number
  availability_status: string
  can_take_more_work: boolean
  created_at: string
  updated_at: string
}

interface ResourceCardProps {
  resource: Resource
}

function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6 hover:shadow-md transition-shadow touch-manipulation">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">{resource.name}</h3>
          <p className="text-sm text-gray-700 dark:text-slate-300 truncate">{resource.role || 'No role specified'}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{resource.email}</p>
          {resource.location && (
            <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-slate-400">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{resource.location}</span>
            </div>
          )}
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
          resource.availability_status === 'available' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' :
          resource.availability_status === 'partially_allocated' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300' :
          resource.availability_status === 'mostly_allocated' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300' :
          'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
        }`}
        >
          {resource.availability_status.replace('_', ' ')}
        </div>
      </div>
      
      <div className="mt-4">
        <div className="flex justify-between text-sm text-gray-700 dark:text-slate-300 mb-2">
          <span>Utilization</span>
          <span className="font-medium">{resource.utilization_percentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 touch-manipulation">
          <div 
            className={`h-3 rounded-full transition-all duration-300 ${
              resource.utilization_percentage <= 70 ? 'bg-green-500' :
              resource.utilization_percentage <= 90 ? 'bg-yellow-500' :
              resource.utilization_percentage <= 100 ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, resource.utilization_percentage)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 dark:text-slate-300">Available Hours:</span>
          <span className="font-medium text-gray-900 dark:text-slate-100">{resource.available_hours.toFixed(1)}h/week</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 dark:text-slate-300">Current Projects:</span>
          <span className="font-medium text-gray-900 dark:text-slate-100">{resource.current_projects.length}</span>
        </div>
        {resource.hourly_rate && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-slate-300">Hourly Rate:</span>
            <span className="font-medium text-gray-900 dark:text-slate-100">${resource.hourly_rate}/hr</span>
          </div>
        )}
      </div>

      {resource.skills.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-700 dark:text-slate-300 mb-2">Skills:</p>
          <div className="flex flex-wrap gap-1">
            {resource.skills.slice(0, 3).map((skill, index) => (
              <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded touch-manipulation">
                {skill}
              </span>
            ))}
            {resource.skills.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs rounded">
                +{resource.skills.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between">
        <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 active:text-blue-900 min-h-[44px] px-3 py-2 -mx-3 -my-2 rounded touch-manipulation">
          View Details
        </button>
        <button className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 active:text-gray-900 min-h-[44px] px-3 py-2 -mx-3 -my-2 rounded touch-manipulation">
          Edit
        </button>
      </div>
    </div>
  )
}

// Custom comparison function to prevent unnecessary re-renders
// Only re-render if resource data actually changes
const arePropsEqual = (prevProps: ResourceCardProps, nextProps: ResourceCardProps) => {
  const prev = prevProps.resource
  const next = nextProps.resource
  
  // Compare key fields that affect rendering
  return (
    prev.id === next.id &&
    prev.name === next.name &&
    prev.email === next.email &&
    prev.role === next.role &&
    prev.utilization_percentage === next.utilization_percentage &&
    prev.available_hours === next.available_hours &&
    prev.availability_status === next.availability_status &&
    prev.current_projects.length === next.current_projects.length &&
    prev.hourly_rate === next.hourly_rate &&
    prev.location === next.location &&
    prev.skills.length === next.skills.length &&
    prev.skills.every((skill, index) => skill === next.skills[index])
  )
}

export default memo(ResourceCard, arePropsEqual)
