'use client'

// Leaderboard for Costbook (Task 48)

import React from 'react'
import { Trophy } from 'lucide-react'

export interface LeaderboardEntry {
  userId: string
  displayName: string
  badgeCount: number
  rank: number
}

export interface LeaderboardProps {
  entries: LeaderboardEntry[]
  maxItems?: number
  className?: string
}

export function Leaderboard({ entries, maxItems = 10, className = '' }: LeaderboardProps) {
  const top = entries.slice(0, maxItems)
  if (top.length === 0) return null
  return (
    <div className={`bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 ${className}`}>
      <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        Top badge earners
      </h3>
      <ol className="space-y-2">
        {top.map((e) => (
          <li key={e.userId} className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-slate-300">#{e.rank} {e.displayName}</span>
            <span className="text-gray-500 dark:text-slate-400">{e.badgeCount} badges</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
