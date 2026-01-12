'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { cn } from '../../lib/utils/design-system'

interface GuidanceRule {
  id: string
  trigger: 'time-based' | 'action-based' | 'error-based' | 'pattern-based'
  condition: (context: UserContext) => boolean
  message: string
  priority: 'low' | 'medium' | 'high'
  actionable?: {
    label: string
    action: () => void
  }
}

interface UserContext {
  currentPage: string
  timeOnPage: number
  clickCount: number
  errorCount: number
  lastAction: string
  strugglingIndicators: string[]
}

export interface ProactiveGuidanceProps {
  isEnabled?: boolean
  onGuidanceShown?: (ruleId: string) => void
  className?: string
}

const GUIDANCE_RULES: GuidanceRule[] = [
  {
    id: 'long-time-no-action',
    trigger: 'time-based',
    condition: (ctx) => ctx.timeOnPage > 30000 && ctx.clickCount < 3,
    message: 'Need help getting started? I can show you around!',
    priority: 'medium',
    actionable: {
      label: 'Take a tour',
      action: () => console.log('Starting tour')
    }
  },
  {
    id: 'repeated-errors',
    trigger: 'error-based', 
    condition: (ctx) => ctx.errorCount > 2,
    message: 'I noticed some errors. Let me help you troubleshoot.',
    priority: 'high',
    actionable: {
      label: 'Get help',
      action: () => console.log('Opening help')
    }
  }
]

export const ProactiveGuidance: React.FC<ProactiveGuidanceProps> = ({
  isEnabled = true,
  onGuidanceShown,
  className
}) => {
  const [activeGuidance, setActiveGuidance] = useState<GuidanceRule | null>(null)
  const [userContext] = useState<UserContext>({
    currentPage: '',
    timeOnPage: 0,
    clickCount: 0,
    errorCount: 0,
    lastAction: '',
    strugglingIndicators: []
  })

  const checkGuidanceRules = useCallback(() => {
    if (!isEnabled) return

    for (const rule of GUIDANCE_RULES) {
      if (rule.condition(userContext)) {
        setActiveGuidance(rule)
        onGuidanceShown?.(rule.id)
        break
      }
    }
  }, [userContext, isEnabled, onGuidanceShown])

  useEffect(() => {
    checkGuidanceRules()
  }, [checkGuidanceRules])

  if (!activeGuidance) return null

  return (
    <div className={cn("fixed bottom-4 right-4 z-50", className)}>
      <div className="bg-white rounded-lg shadow-lg border p-4 max-w-sm">
        <div className="flex items-start space-x-3">
          <Lightbulb className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-gray-800">{activeGuidance.message}</p>
            {activeGuidance.actionable && (
              <button
                onClick={activeGuidance.actionable.action}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                {activeGuidance.actionable.label}
              </button>
            )}
          </div>
          <button
            onClick={() => setActiveGuidance(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProactiveGuidance