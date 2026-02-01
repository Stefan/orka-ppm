'use client'

// Gamification Badges for Costbook (Task 48)

import React from 'react'
import { Award } from 'lucide-react'
import { BadgeType, getBadgeDescription } from '@/lib/gamification-engine'

export interface GamificationBadgesProps {
  earnedBadges: BadgeType[]
  onBadgeClick?: (badge: BadgeType) => void
  className?: string
}

export function GamificationBadges({ earnedBadges, onBadgeClick, className = '' }: GamificationBadgesProps) {
  if (earnedBadges.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {earnedBadges.map((badge) => (
        <button
          key={badge}
          type="button"
          onClick={() => onBadgeClick?.(badge)}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs"
          title={getBadgeDescription(badge)}
        >
          <Award className="w-3 h-3" />
          {badge.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  )
}
