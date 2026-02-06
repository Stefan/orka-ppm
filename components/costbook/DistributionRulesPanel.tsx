'use client'

import React, { useState } from 'react'
import { Plus, Play, Pause, Edit2, Trash2, BarChart3, Zap, Brain, Clock, TrendingUp } from 'lucide-react'
import { DistributionRule, DistributionRuleType, DistributionProfile } from '@/types/costbook'
import { RuleTrigger } from '@/lib/costbook/distribution-engine'

export interface DistributionRulesPanelProps {
  rules: DistributionRule[]
  onCreateRule: (rule: Omit<DistributionRule, 'id' | 'created_at' | 'last_applied' | 'application_count'>) => void
  onUpdateRule: (ruleId: string, updates: Partial<DistributionRule>) => void
  onDeleteRule: (ruleId: string) => void
  onApplyRule: (ruleId: string, projectIds: string[]) => void
  className?: string
}

/**
 * DistributionRulesPanel Component
 * Phase 3: Distribution Rules Engine for automated forecast distribution
 */
export function DistributionRulesPanel({
  rules,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onApplyRule,
  className = ''
}: DistributionRulesPanelProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedRule, setSelectedRule] = useState<DistributionRule | null>(null)

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Distribution Rules</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Automate forecast distribution with AI-powered rules
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Rule</span>
        </button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-8 text-center">
          <Brain className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-slate-400 font-medium">No distribution rules yet</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Create rules to automate budget distribution across time periods
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="mt-4 px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 rounded-md transition-colors"
          >
            Create your first rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => setSelectedRule(rule)}
              onDelete={() => onDeleteRule(rule.id)}
              onApply={(projectIds) => onApplyRule(rule.id, projectIds)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {(showCreateDialog || selectedRule) && (
        <RuleEditorDialog
          rule={selectedRule}
          onClose={() => {
            setShowCreateDialog(false)
            setSelectedRule(null)
          }}
          onSave={(rule) => {
            if (selectedRule) {
              onUpdateRule(selectedRule.id, rule)
            } else {
              onCreateRule(rule)
            }
            setShowCreateDialog(false)
            setSelectedRule(null)
          }}
        />
      )}
    </div>
  )
}

interface RuleCardProps {
  rule: DistributionRule
  onEdit: () => void
  onDelete: () => void
  onApply: (projectIds: string[]) => void
}

function RuleCard({ rule, onEdit, onDelete, onApply }: RuleCardProps) {
  const getRuleIcon = (type: DistributionRuleType) => {
    switch (type) {
      case 'automatic':
        return <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      case 'reprofiling':
        return <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      case 'ai_generator':
        return <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
    }
  }

  const getRuleColor = (type: DistributionRuleType) => {
    switch (type) {
      case 'automatic':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'reprofiling':
        return 'bg-amber-50 border-amber-200'
      case 'ai_generator':
        return 'bg-purple-50 border-purple-200'
    }
  }

  return (
    <div className={`border rounded-lg p-4 ${getRuleColor(rule.type)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="mt-0.5">
            {getRuleIcon(rule.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{rule.name}</h4>
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-xs text-gray-600 dark:text-slate-400 capitalize">
                {rule.type.replace('_', ' ')}
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400">•</span>
              <span className="text-xs text-gray-600 dark:text-slate-400 capitalize">
                {rule.profile.replace('_', ' ')} profile
              </span>
            </div>
            <div className="flex items-center space-x-4 mt-2">
              <div className="text-xs text-gray-500 dark:text-slate-400">
                <Clock className="w-3 h-3 inline mr-1" />
                Applied {rule.application_count} times
              </div>
              {rule.last_applied && (
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  Last: {new Date(rule.last_applied).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={() => onApply([])}
            className="p-2 text-gray-600 dark:text-slate-400 hover:text-green-600 hover:bg-white dark:bg-slate-800 rounded transition-colors"
            title="Apply rule"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 dark:text-slate-400 hover:text-blue-600 hover:bg-white dark:bg-slate-800 rounded transition-colors"
            title="Edit rule"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-600 dark:text-slate-400 hover:text-red-600 hover:bg-white dark:bg-slate-800 rounded transition-colors"
            title="Delete rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface RuleEditorDialogProps {
  rule: DistributionRule | null
  onClose: () => void
  onSave: (rule: Omit<DistributionRule, 'id' | 'created_at' | 'last_applied' | 'application_count'>) => void
}

function RuleEditorDialog({ rule, onClose, onSave }: RuleEditorDialogProps) {
  const [name, setName] = useState(rule?.name || '')
  const [type, setType] = useState<DistributionRuleType>(rule?.type || 'automatic')
  const [profile, setProfile] = useState<DistributionProfile>(rule?.profile || 'linear')
  const [durationStart, setDurationStart] = useState(rule?.settings.duration_start || '')
  const [durationEnd, setDurationEnd] = useState(rule?.settings.duration_end || '')
  const [granularity, setGranularity] = useState<'week' | 'month'>(rule?.settings.granularity || 'month')

  const handleSave = () => {
    if (!name.trim() || !durationStart || !durationEnd) return

    onSave({
      name: name.trim(),
      type,
      profile,
      settings: {
        profile,
        duration_start: durationStart,
        duration_end: durationEnd,
        granularity
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {rule ? 'Edit Rule' : 'Create New Rule'}
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {/* Rule Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Rule Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Monthly Linear Distribution"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Rule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Rule Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DistributionRuleType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="automatic">Automatic (Linear)</option>
              <option value="reprofiling">Reprofiling (Adaptive)</option>
              <option value="ai_generator">AI Generator (Intelligent)</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {type === 'automatic' && 'Evenly distribute budget across periods'}
              {type === 'reprofiling' && 'Adjust based on actual consumption patterns'}
              {type === 'ai_generator' && 'Use ML to predict optimal distribution'}
            </p>
          </div>

          {/* Profile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Distribution Profile
            </label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as DistributionProfile)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="linear">Linear</option>
              <option value="custom">Custom</option>
              <option value="ai_generated">AI Generated</option>
            </select>
          </div>

          {/* Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={durationStart}
                onChange={(e) => setDurationStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={durationEnd}
                onChange={(e) => setDurationEnd(e.target.value)}
                min={durationStart}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Granularity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Granularity
            </label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'week' | 'month')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !durationStart || !durationEnd}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {rule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
