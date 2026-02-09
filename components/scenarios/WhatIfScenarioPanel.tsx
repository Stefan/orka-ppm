'use client';

/**
 * What-If Scenario Analysis Panel
 * 
 * Provides interface for creating, comparing, and analyzing project scenarios
 * with real-time parameter adjustment and impact visualization.
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Plus, GitCompare, Edit2, Trash2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/context';

interface ScenarioImpact {
  timeline?: {
    original_duration: number;
    new_duration: number;
    duration_change: number;
    critical_path_affected: boolean;
    affected_milestones: string[];
  };
  cost?: {
    original_cost: number;
    new_cost: number;
    cost_change: number;
    cost_change_percentage: number;
    affected_categories: string[];
  };
  resource?: {
    utilization_changes: Record<string, number>;
    over_allocated_resources: string[];
    under_allocated_resources: string[];
    new_resource_requirements: string[];
  };
}

interface Scenario {
  id: string;
  name: string;
  description?: string;
  parameter_changes: any;
  timeline_impact?: ScenarioImpact['timeline'];
  cost_impact?: ScenarioImpact['cost'];
  resource_impact?: ScenarioImpact['resource'];
  created_at: string;
  is_baseline: boolean;
}

interface WhatIfScenarioPanelProps {
  projectId: string;
  onScenarioCreate?: (scenario: Scenario) => void;
  onScenarioCompare?: (scenarioIds: string[]) => void;
}

export default function WhatIfScenarioPanel({ 
  projectId, 
  onScenarioCreate,
  onScenarioCompare 
}: WhatIfScenarioPanelProps) {
  const { t } = useTranslations();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadScenarios();
  }, [projectId]);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/simulations/what-if/projects/${projectId}/scenarios`);
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScenarioSelect = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      } else if (prev.length < 5) {
        return [...prev, scenarioId];
      }
      return prev;
    });
  };

  const handleCompare = () => {
    if (selectedScenarios.length >= 2 && onScenarioCompare) {
      onScenarioCompare(selectedScenarios);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDuration = (days: number) => {
    if (Math.abs(days) < 7) {
      return t('common.days', { count: Math.abs(days) });
    }
    const weeks = Math.round(days / 7);
    return t('common.weeks', { count: Math.abs(weeks) });
  };

  const renderImpactBadge = (scenario: Scenario) => {
    const impacts = [];
    
    if (scenario.cost_impact) {
      const change = scenario.cost_impact.cost_change;
      const isIncrease = change > 0;
      impacts.push(
        <div key="cost" className={`flex items-center gap-1 text-xs ${isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {isIncrease ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{formatCurrency(Math.abs(change))}</span>
        </div>
      );
    }
    
    if (scenario.timeline_impact) {
      const change = scenario.timeline_impact.duration_change;
      const isDelay = change > 0;
      impacts.push(
        <div key="timeline" className={`flex items-center gap-1 text-xs ${isDelay ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {isDelay ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{formatDuration(Math.abs(change))}</span>
        </div>
      );
    }
    
    if (scenario.resource_impact && scenario.resource_impact.over_allocated_resources.length > 0) {
      impacts.push(
        <div key="resource" className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-3 h-3" />
          <span>{t('scenarios.overAllocated', { count: scenario.resource_impact.over_allocated_resources.length })}</span>
        </div>
      );
    }
    
    return impacts.length > 0 ? (
      <div className="flex flex-wrap gap-2 mt-2">
        {impacts}
      </div>
    ) : null;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{t('scenarios.whatIfScenarios')}</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {t('scenarios.analyzeParameterChanges')}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('scenarios.newScenario')}
          </button>
        </div>
      </div>

      <div className="p-6">
        {scenarios.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-slate-500 mb-4">
              <GitCompare className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">{t('scenarios.noScenariosYet')}</h3>
            <p className="text-gray-600 dark:text-slate-400 mb-4">
              {t('scenarios.createFirstWhatIf')}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('scenarios.createScenarioButton')}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className={`border rounded-lg p-4 transition-all ${
                    selectedScenarios.includes(scenario.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                  } ${scenario.is_baseline ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedScenarios.includes(scenario.id)}
                        onChange={() => handleScenarioSelect(scenario.id)}
                        className="mt-1 w-4 h-4 text-blue-600 dark:text-blue-400 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-slate-100">{scenario.name}</h3>
                          {scenario.is_baseline && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                              {t('scenarios.baseline')}
                            </span>
                          )}
                        </div>
                        {scenario.description && (
                          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{scenario.description}</p>
                        )}
                        {renderImpactBadge(scenario)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        className="p-2 text-gray-400 dark:text-slate-500 hover:text-blue-600 transition-colors"
                        title={t('scenarios.editScenario')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-gray-400 dark:text-slate-500 hover:text-red-600 transition-colors"
                        title={t('scenarios.deleteScenario')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedScenarios.length >= 2 && (
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-blue-900">
                  {t('scenarios.scenariosSelectedForComparison', { count: selectedScenarios.length })}
                </div>
                <button
                  onClick={handleCompare}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <GitCompare className="w-4 h-4" />
                  {t('scenarios.compareScenarios')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Create New Scenario</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                Scenario creation form would go here with parameter adjustment controls.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    loadScenarios();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Scenario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
