'use client'

import React from 'react'
import { CheckCircle, Circle, Clock, Trophy, Star } from 'lucide-react'
import { cn } from '../../lib/utils/design-system'
import { OnboardingTour } from './OnboardingTour'
import { useOnboardingTour } from '../../hooks/useOnboardingTour'

export interface OnboardingProgressProps {
  userRole?: string
  showRecommendations?: boolean
  className?: string
}

interface TourProgressCardProps {
  tour: OnboardingTour
  progress: {
    completedSteps: number[]
    isCompleted: boolean
    lastAccessedAt?: Date
    completedAt?: Date
  } | null
  onStartTour: (tour: OnboardingTour) => void
  onResumeTour: (tour: OnboardingTour) => void
}

const TourProgressCard: React.FC<TourProgressCardProps> = ({
  tour,
  progress,
  onStartTour,
  onResumeTour
}) => {
  const completedSteps = progress?.completedSteps?.length || 0
  const totalSteps = tour.steps.length
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
  const isCompleted = progress?.isCompleted || false
  const isStarted = completedSteps > 0 && !isCompleted

  const getCategoryIcon = (category: OnboardingTour['category']) => {
    switch (category) {
      case 'first-time':
        return Star
      case 'feature':
        return Circle
      case 'workflow':
        return Clock
      case 'advanced':
        return Trophy
      default:
        return Circle
    }
  }

  const getCategoryColor = (category: OnboardingTour['category']) => {
    switch (category) {
      case 'first-time':
        return 'text-yellow-600 bg-yellow-100'
      case 'feature':
        return 'text-blue-600 bg-blue-100'
      case 'workflow':
        return 'text-green-600 bg-green-100'
      case 'advanced':
        return 'text-purple-600 bg-purple-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const CategoryIcon = getCategoryIcon(tour.category)
  const categoryColor = getCategoryColor(tour.category)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={cn("p-2 rounded-full", categoryColor)}>
            <CategoryIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{tour.title}</h3>
            <p className="text-sm text-gray-600">{tour.description}</p>
          </div>
        </div>
        
        {isCompleted && (
          <div className="flex items-center text-green-600">
            <CheckCircle className="h-5 w-5 mr-1" />
            <span className="text-sm font-medium">Completed</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{completedSteps}/{totalSteps} steps</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              isCompleted ? "bg-green-500" : "bg-blue-500"
            )}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Tour Details */}
      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            ~{tour.estimatedTime} min
          </span>
          {tour.userRole && (
            <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
              {tour.userRole.join(', ')}
            </span>
          )}
        </div>
        
        {progress?.completedAt && (
          <span className="text-green-600">
            Completed {new Date(progress.completedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between">
        <div>
          {progress?.lastAccessedAt && !isCompleted && (
            <p className="text-xs text-gray-500">
              Last accessed {new Date(progress.lastAccessedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        
        <button
          onClick={() => {
            if (isStarted && !isCompleted) {
              onResumeTour(tour)
            } else if (!isCompleted) {
              onStartTour(tour)
            }
          }}
          disabled={isCompleted}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            isCompleted
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : isStarted
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-green-600 text-white hover:bg-green-700"
          )}
        >
          {isCompleted
            ? "Completed"
            : isStarted
            ? "Resume Tour"
            : "Start Tour"
          }
        </button>
      </div>
    </div>
  )
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  userRole,
  showRecommendations = true,
  className
}) => {
  const {
    startTour,
    resumeTour,
    getProgress,
    getAllProgress,
    getRecommendedTours
  } = useOnboardingTour()

  const recommendedTours = getRecommendedTours(userRole)
  const allProgress = getAllProgress()
  
  const completedTours = allProgress.filter(p => p.isCompleted).length
  const totalRecommendedTours = recommendedTours.length
  const overallProgress = totalRecommendedTours > 0 
    ? (completedTours / totalRecommendedTours) * 100 
    : 0

  const handleStartTour = (tour: OnboardingTour) => {
    startTour(tour)
  }

  const handleResumeTour = (tour: OnboardingTour) => {
    resumeTour()
    startTour(tour)
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overall Progress Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Learning Journey</h2>
            <p className="text-gray-600 mt-1">
              Complete onboarding tours to master the platform
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">
              {Math.round(overallProgress)}%
            </div>
            <div className="text-sm text-gray-600">
              {completedTours} of {totalRecommendedTours} completed
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="w-full bg-white rounded-full h-3 shadow-inner">
          <div
            className="h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        {/* Achievement Badges */}
        {completedTours > 0 && (
          <div className="flex items-center mt-4 space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700">
              {completedTours === 1 
                ? "First tour completed! 🎉" 
                : completedTours >= totalRecommendedTours
                ? "All tours completed! You're a master! 🏆"
                : `${completedTours} tours completed! Keep going! 💪`
              }
            </span>
          </div>
        )}
      </div>

      {/* Recommended Tours */}
      {showRecommendations && recommendedTours.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recommended for You
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {recommendedTours.map(tour => (
              <TourProgressCard
                key={tour.id}
                tour={tour}
                progress={getProgress(tour.id)}
                onStartTour={handleStartTour}
                onResumeTour={handleResumeTour}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recommendedTours.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            All Caught Up!
          </h3>
          <p className="text-gray-600">
            You've completed all available onboarding tours. Great job!
          </p>
        </div>
      )}

      {/* Quick Stats */}
      {allProgress.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Stats</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{completedTours}</div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {allProgress.reduce((sum, p) => sum + (p.completedSteps?.length || 0), 0)}
              </div>
              <div className="text-xs text-gray-600">Steps Done</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(recommendedTours.reduce((sum, tour) => sum + tour.estimatedTime, 0) * (overallProgress / 100))}
              </div>
              <div className="text-xs text-gray-600">Minutes Learned</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {overallProgress >= 100 ? '🏆' : overallProgress >= 75 ? '⭐' : overallProgress >= 50 ? '🎯' : '🌱'}
              </div>
              <div className="text-xs text-gray-600">Achievement</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OnboardingProgress