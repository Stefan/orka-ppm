'use client'

import { useState, useEffect } from 'react'
import { Calculator, DollarSign, Calendar, AlertTriangle, Save, RotateCcw, Copy, FileText, Target, Lightbulb, BookOpen } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

// Types for impact estimation
interface ImpactEstimate {
  cost_impact: number
  schedule_impact_days: number
  resource_impact: {
    additional_resources: number
    reallocation_cost: number
  }
  risk_impact: {
    new_risks_count: number
    risk_mitigation_cost: number
  }
  confidence_level: number
}

interface EstimationTemplate {
  id: string
  name: string
  description: string
  change_type: string
  default_values: {
    cost_multiplier: number
    schedule_multiplier: number
    risk_factor: number
  }
  estimation_rules: Array<{
    condition: string
    adjustment: number
    description: string
  }>
}

interface WhatIfScenario {
  id: string
  name: string
  description: string
  parameters: {
    cost_adjustment: number
    schedule_adjustment: number
    resource_adjustment: number
    risk_adjustment: number
  }
  results: ImpactEstimate
}

interface ImpactEstimationToolsProps {
  changeId: string
  changeType: string
  projectValue: number
  currentEstimate?: ImpactEstimate
  onEstimateUpdate: (estimate: ImpactEstimate) => void
  onSaveTemplate?: (template: EstimationTemplate) => void
}

export default function ImpactEstimationTools({
  changeId: _changeId,
  changeType: _changeType,
  projectValue,
  currentEstimate,
  onEstimateUpdate,
  onSaveTemplate: _onSaveTemplate
}: ImpactEstimationToolsProps) {
  const t = useTranslations('changes');
  const [activeTab, setActiveTab] = useState<'calculator' | 'scenarios' | 'templates'>('calculator')
  const [estimate, setEstimate] = useState<ImpactEstimate>(
    currentEstimate || {
      cost_impact: 0,
      schedule_impact_days: 0,
      resource_impact: {
        additional_resources: 0,
        reallocation_cost: 0
      },
      risk_impact: {
        new_risks_count: 0,
        risk_mitigation_cost: 0
      },
      confidence_level: 0.5
    }
  )

  const [calculatorInputs, setCalculatorInputs] = useState({
    // Cost factors
    material_cost_change: 0,
    labor_hours_change: 0,
    labor_rate: 75,
    equipment_days_change: 0,
    equipment_rate: 500,
    overhead_percentage: 15,
    contingency_percentage: 10,
    
    // Schedule factors
    critical_path_impact: false,
    parallel_work_possible: false,
    weather_dependency: false,
    resource_availability: 1.0,
    
    // Resource factors
    additional_specialists: 0,
    specialist_rate: 150,
    resource_reallocation_hours: 0,
    
    // Risk factors
    technical_complexity: 'medium',
    regulatory_impact: 'low',
    stakeholder_impact: 'medium',
    external_dependencies: 'low'
  })

  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([
    {
      id: 'optimistic',
      name: 'Optimistic Scenario',
      description: 'Best case with minimal delays and cost overruns',
      parameters: {
        cost_adjustment: -0.2,
        schedule_adjustment: -0.3,
        resource_adjustment: -0.1,
        risk_adjustment: -0.4
      },
      results: {
        cost_impact: 0,
        schedule_impact_days: 0,
        resource_impact: { additional_resources: 0, reallocation_cost: 0 },
        risk_impact: { new_risks_count: 0, risk_mitigation_cost: 0 },
        confidence_level: 0.2
      }
    },
    {
      id: 'realistic',
      name: 'Realistic Scenario',
      description: 'Most likely outcome based on historical data',
      parameters: {
        cost_adjustment: 0,
        schedule_adjustment: 0,
        resource_adjustment: 0,
        risk_adjustment: 0
      },
      results: {
        cost_impact: 0,
        schedule_impact_days: 0,
        resource_impact: { additional_resources: 0, reallocation_cost: 0 },
        risk_impact: { new_risks_count: 0, risk_mitigation_cost: 0 },
        confidence_level: 0.7
      }
    },
    {
      id: 'pessimistic',
      name: 'Pessimistic Scenario',
      description: 'Worst case with significant delays and cost overruns',
      parameters: {
        cost_adjustment: 0.5,
        schedule_adjustment: 0.8,
        resource_adjustment: 0.3,
        risk_adjustment: 0.6
      },
      results: {
        cost_impact: 0,
        schedule_impact_days: 0,
        resource_impact: { additional_resources: 0, reallocation_cost: 0 },
        risk_impact: { new_risks_count: 0, risk_mitigation_cost: 0 },
        confidence_level: 0.1
      }
    }
  ])

  const [templates] = useState<EstimationTemplate[]>([
    {
      id: 'design-change',
      name: 'Design Change Template',
      description: 'Standard template for design modifications',
      change_type: 'design',
      default_values: {
        cost_multiplier: 1.2,
        schedule_multiplier: 1.15,
        risk_factor: 1.1
      },
      estimation_rules: [
        {
          condition: 'Structural changes',
          adjustment: 0.3,
          description: 'Additional engineering review and approval time'
        },
        {
          condition: 'MEP system impact',
          adjustment: 0.2,
          description: 'Coordination with multiple trades required'
        }
      ]
    },
    {
      id: 'scope-change',
      name: 'Scope Change Template',
      description: 'Template for scope additions or reductions',
      change_type: 'scope',
      default_values: {
        cost_multiplier: 1.1,
        schedule_multiplier: 1.25,
        risk_factor: 1.2
      },
      estimation_rules: [
        {
          condition: 'Additional permits required',
          adjustment: 0.4,
          description: 'Regulatory approval delays'
        },
        {
          condition: 'New subcontractors needed',
          adjustment: 0.25,
          description: 'Procurement and mobilization time'
        }
      ]
    },
    {
      id: 'schedule-change',
      name: 'Schedule Change Template',
      description: 'Template for schedule acceleration or delays',
      change_type: 'schedule',
      default_values: {
        cost_multiplier: 1.3,
        schedule_multiplier: 0.8,
        risk_factor: 1.4
      },
      estimation_rules: [
        {
          condition: 'Overtime work required',
          adjustment: 0.5,
          description: 'Premium labor rates and reduced productivity'
        },
        {
          condition: 'Parallel work streams',
          adjustment: 0.2,
          description: 'Coordination complexity increases'
        }
      ]
    }
  ])

  const [selectedTemplate, setSelectedTemplate] = useState<EstimationTemplate | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Calculate impact based on inputs
  const calculateImpact = () => {
    setIsCalculating(true)
    
    // Simulate calculation delay
    setTimeout(() => {
      // Cost calculation
      const materialCost = calculatorInputs.material_cost_change
      const laborCost = calculatorInputs.labor_hours_change * calculatorInputs.labor_rate
      const equipmentCost = calculatorInputs.equipment_days_change * calculatorInputs.equipment_rate
      const directCost = materialCost + laborCost + equipmentCost
      const overhead = directCost * (calculatorInputs.overhead_percentage / 100)
      const contingency = (directCost + overhead) * (calculatorInputs.contingency_percentage / 100)
      const totalCostImpact = directCost + overhead + contingency

      // Schedule calculation
      let scheduleImpact = Math.max(
        calculatorInputs.labor_hours_change / 8, // Convert hours to days
        calculatorInputs.equipment_days_change
      )
      
      if (calculatorInputs.critical_path_impact) scheduleImpact *= 1.5
      if (!calculatorInputs.parallel_work_possible) scheduleImpact *= 1.2
      if (calculatorInputs.weather_dependency) scheduleImpact *= 1.1
      scheduleImpact /= calculatorInputs.resource_availability

      // Resource calculation
      const additionalResourceCost = calculatorInputs.additional_specialists * calculatorInputs.specialist_rate * 5 // 5 days per week
      const reallocationCost = calculatorInputs.resource_reallocation_hours * calculatorInputs.labor_rate

      // Risk calculation
      const complexityFactors = {
        low: 0.5,
        medium: 1.0,
        high: 1.5
      }
      
      const riskMultiplier = (
        complexityFactors[calculatorInputs.technical_complexity as keyof typeof complexityFactors] +
        complexityFactors[calculatorInputs.regulatory_impact as keyof typeof complexityFactors] +
        complexityFactors[calculatorInputs.stakeholder_impact as keyof typeof complexityFactors] +
        complexityFactors[calculatorInputs.external_dependencies as keyof typeof complexityFactors]
      ) / 4

      const newRisksCount = Math.ceil(riskMultiplier * 2)
      const riskMitigationCost = totalCostImpact * 0.05 * riskMultiplier

      // Confidence calculation
      const confidenceLevel = Math.max(0.1, Math.min(0.9, 
        1 - (riskMultiplier - 1) * 0.3 - (scheduleImpact > 10 ? 0.2 : 0) - (totalCostImpact > projectValue * 0.1 ? 0.2 : 0)
      ))

      const newEstimate: ImpactEstimate = {
        cost_impact: Math.round(totalCostImpact),
        schedule_impact_days: Math.round(scheduleImpact),
        resource_impact: {
          additional_resources: Math.round(additionalResourceCost),
          reallocation_cost: Math.round(reallocationCost)
        },
        risk_impact: {
          new_risks_count: newRisksCount,
          risk_mitigation_cost: Math.round(riskMitigationCost)
        },
        confidence_level: Math.round(confidenceLevel * 100) / 100
      }

      setEstimate(newEstimate)
      onEstimateUpdate(newEstimate)
      setIsCalculating(false)
    }, 1500)
  }

  // Calculate scenario results
  const calculateScenarioResults = (scenario: WhatIfScenario) => {
    const baseEstimate = estimate
    const params = scenario.parameters

    const results: ImpactEstimate = {
      cost_impact: Math.round(baseEstimate.cost_impact * (1 + params.cost_adjustment)),
      schedule_impact_days: Math.round(baseEstimate.schedule_impact_days * (1 + params.schedule_adjustment)),
      resource_impact: {
        additional_resources: Math.round(baseEstimate.resource_impact.additional_resources * (1 + params.resource_adjustment)),
        reallocation_cost: Math.round(baseEstimate.resource_impact.reallocation_cost * (1 + params.resource_adjustment))
      },
      risk_impact: {
        new_risks_count: Math.max(0, Math.round(baseEstimate.risk_impact.new_risks_count * (1 + params.risk_adjustment))),
        risk_mitigation_cost: Math.round(baseEstimate.risk_impact.risk_mitigation_cost * (1 + params.risk_adjustment))
      },
      confidence_level: scenario.id === 'optimistic' ? 0.2 : scenario.id === 'realistic' ? 0.7 : 0.1
    }

    return results
  }

  // Apply template
  const applyTemplate = (template: EstimationTemplate) => {
    setSelectedTemplate(template)
    
    // Apply template defaults to calculator inputs
    const updatedInputs = { ...calculatorInputs }
    
    // Apply multipliers to current values
    if (updatedInputs.material_cost_change > 0) {
      updatedInputs.material_cost_change *= template.default_values.cost_multiplier
    }
    if (updatedInputs.labor_hours_change > 0) {
      updatedInputs.labor_hours_change *= template.default_values.schedule_multiplier
    }
    
    // Adjust contingency based on risk factor
    updatedInputs.contingency_percentage = Math.round(updatedInputs.contingency_percentage * template.default_values.risk_factor)
    
    setCalculatorInputs(updatedInputs)
  }

  // Reset calculator
  const resetCalculator = () => {
    setCalculatorInputs({
      material_cost_change: 0,
      labor_hours_change: 0,
      labor_rate: 75,
      equipment_days_change: 0,
      equipment_rate: 500,
      overhead_percentage: 15,
      contingency_percentage: 10,
      critical_path_impact: false,
      parallel_work_possible: false,
      weather_dependency: false,
      resource_availability: 1.0,
      additional_specialists: 0,
      specialist_rate: 150,
      resource_reallocation_hours: 0,
      technical_complexity: 'medium',
      regulatory_impact: 'low',
      stakeholder_impact: 'medium',
      external_dependencies: 'low'
    })
    setSelectedTemplate(null)
  }

  // Update scenarios with current estimate
  useEffect(() => {
    const updatedScenarios = scenarios.map(scenario => ({
      ...scenario,
      results: calculateScenarioResults(scenario)
    }))
    setScenarios(updatedScenarios)
  }, [estimate])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('impactEstimation.title')}</h2>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              {t('impactEstimation.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetCalculator}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-slate-200 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
            >
              <RotateCcw className="h-4 w-4" />
              {t('impactEstimation.reset')}
            </button>
            <button
              onClick={() => onEstimateUpdate(estimate)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Save className="h-4 w-4" />
              {t('impactEstimation.saveEstimate')}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'calculator', label: t('impactEstimation.tabs.calculator'), icon: Calculator },
              { id: 'scenarios', label: t('impactEstimation.tabs.scenarios'), icon: Target },
              { id: 'templates', label: t('impactEstimation.tabs.templates'), icon: BookOpen }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Impact Calculator Tab */}
          {activeTab === 'calculator' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calculator Inputs */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Cost Factors */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                      Cost Factors
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Material Cost Change ($)
                        </label>
                        <input
                          type="number"
                          value={calculatorInputs.material_cost_change}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            material_cost_change: parseFloat(e.target.value) || 0
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Additional Labor Hours
                        </label>
                        <input
                          type="number"
                          value={calculatorInputs.labor_hours_change}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            labor_hours_change: parseFloat(e.target.value) || 0
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Labor Rate ($/hour)
                        </label>
                        <input
                          type="number"
                          value={calculatorInputs.labor_rate}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            labor_rate: parseFloat(e.target.value) || 0
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Additional Equipment Days
                        </label>
                        <input
                          type="number"
                          value={calculatorInputs.equipment_days_change}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            equipment_days_change: parseFloat(e.target.value) || 0
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Overhead Percentage (%)
                        </label>
                        <input
                          type="number"
                          value={calculatorInputs.overhead_percentage}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            overhead_percentage: parseFloat(e.target.value) || 0
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Contingency Percentage (%)
                        </label>
                        <input
                          type="number"
                          value={calculatorInputs.contingency_percentage}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            contingency_percentage: parseFloat(e.target.value) || 0
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Schedule Factors */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Schedule Factors
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="critical_path"
                          checked={calculatorInputs.critical_path_impact}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            critical_path_impact: e.target.checked
                          }))}
                          className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                        />
                        <label htmlFor="critical_path" className="ml-2 text-sm text-gray-700 dark:text-slate-300">
                          Critical Path Impact
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="parallel_work"
                          checked={calculatorInputs.parallel_work_possible}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            parallel_work_possible: e.target.checked
                          }))}
                          className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                        />
                        <label htmlFor="parallel_work" className="ml-2 text-sm text-gray-700 dark:text-slate-300">
                          Parallel Work Possible
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="weather_dependency"
                          checked={calculatorInputs.weather_dependency}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            weather_dependency: e.target.checked
                          }))}
                          className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                        />
                        <label htmlFor="weather_dependency" className="ml-2 text-sm text-gray-700 dark:text-slate-300">
                          Weather Dependent
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                          Resource Availability (0.1 - 1.0)
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          max="1.0"
                          step="0.1"
                          value={calculatorInputs.resource_availability}
                          onChange={(e) => setCalculatorInputs(prev => ({
                            ...prev,
                            resource_availability: parseFloat(e.target.value) || 1.0
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Risk Factors */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      Risk Factors
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: 'technical_complexity', label: 'Technical Complexity' },
                        { key: 'regulatory_impact', label: 'Regulatory Impact' },
                        { key: 'stakeholder_impact', label: 'Stakeholder Impact' },
                        { key: 'external_dependencies', label: 'External Dependencies' }
                      ].map(factor => (
                        <div key={factor.key}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                            {factor.label}
                          </label>
                          <select
                            value={calculatorInputs[factor.key as keyof typeof calculatorInputs] as string}
                            onChange={(e) => setCalculatorInputs(prev => ({
                              ...prev,
                              [factor.key]: e.target.value
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Results Panel */}
                <div className="space-y-6">
                  {/* Current Estimate */}
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">Current Estimate</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-slate-400">Cost Impact:</span>
                        <span className="font-bold text-lg text-red-600 dark:text-red-400">
                          ${estimate.cost_impact.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-slate-400">Schedule Impact:</span>
                        <span className="font-bold text-lg text-orange-600 dark:text-orange-400">
                          {estimate.schedule_impact_days} days
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-slate-400">Additional Resources:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          ${estimate.resource_impact.additional_resources.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-slate-400">New Risks:</span>
                        <span className="font-medium text-purple-600 dark:text-purple-400">
                          {estimate.risk_impact.new_risks_count}
                        </span>
                      </div>
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 dark:text-slate-400">Confidence Level:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {(estimate.confidence_level * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${estimate.confidence_level * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calculate Button */}
                  <button
                    onClick={calculateImpact}
                    disabled={isCalculating}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium"
                  >
                    {isCalculating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4" />
                        Calculate Impact
                      </>
                    )}
                  </button>

                  {/* Template Selection */}
                  {selectedTemplate && (
                    <div className="bg-blue-50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-blue-900">Template Applied</span>
                      </div>
                      <p className="text-sm text-blue-800 dark:text-blue-300">{selectedTemplate.name}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{selectedTemplate.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* What-If Scenarios Tab */}
          {activeTab === 'scenarios' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Scenario Analysis</h3>
                  <p className="text-gray-600 dark:text-slate-400">Compare different outcome scenarios based on your current estimate</p>
                </div>
                <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                  <Target className="h-4 w-4" />
                  Create Custom Scenario
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {scenarios.map((scenario) => (
                  <div key={scenario.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900 dark:text-slate-100">{scenario.name}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        scenario.id === 'optimistic' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        scenario.id === 'realistic' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                        'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                      }`}>
                        {(scenario.results.confidence_level * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{scenario.description}</p>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-slate-400">Cost Impact:</span>
                        <span className="font-medium">${scenario.results.cost_impact.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-slate-400">Schedule Impact:</span>
                        <span className="font-medium">{scenario.results.schedule_impact_days} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-slate-400">New Risks:</span>
                        <span className="font-medium">{scenario.results.risk_impact.new_risks_count}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <button
                        onClick={() => {
                          setEstimate(scenario.results)
                          onEstimateUpdate(scenario.results)
                        }}
                        className="w-full text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        Apply This Scenario
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Template Library</h3>
                  <p className="text-gray-600 dark:text-slate-400">Pre-configured estimation templates for common change types</p>
                </div>
                <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                  <Lightbulb className="h-4 w-4" />
                  Create Template
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <div key={template.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900 dark:text-slate-100">{template.name}</h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 capitalize">
                        {template.change_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{template.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-slate-400">Cost Multiplier:</span>
                        <span className="font-medium">{template.default_values.cost_multiplier}x</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-slate-400">Schedule Multiplier:</span>
                        <span className="font-medium">{template.default_values.schedule_multiplier}x</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-slate-400">Risk Factor:</span>
                        <span className="font-medium">{template.default_values.risk_factor}x</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">Estimation Rules:</h5>
                      <div className="space-y-1">
                        {template.estimation_rules.slice(0, 2).map((rule, index) => (
                          <div key={index} className="text-xs text-gray-600 dark:text-slate-400">
                            • {rule.condition}: +{(rule.adjustment * 100).toFixed(0)}%
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => applyTemplate(template)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
                      >
                        Apply Template
                      </button>
                      <button className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded text-sm text-gray-600 hover:text-gray-800 dark:text-slate-200">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}