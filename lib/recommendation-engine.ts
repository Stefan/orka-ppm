// Costbook Smart Recommendation Engine
// Phase 2: AI-powered financial recommendations

import { ProjectWithFinancials, Recommendation, ProjectStatus } from '@/types/costbook'
import { AnomalyResult, AnomalyType } from '@/lib/costbook/anomaly-detection'

/**
 * Extended recommendation with additional metadata
 */
export interface EnhancedRecommendation extends Recommendation {
  /** Priority score (0-100) */
  priority: number
  /** Category for grouping */
  category: 'budget' | 'vendor' | 'timeline' | 'risk' | 'optimization'
  /** Related project IDs */
  relatedProjects: string[]
  /** Supporting metrics */
  supportingData: {
    metric: string
    value: number
    unit: string
    trend?: 'up' | 'down' | 'stable'
  }[]
  /** Potential risks if not addressed */
  risks: string[]
  /** Status of the recommendation */
  status: 'pending' | 'acknowledged' | 'accepted' | 'rejected' | 'deferred'
}

/**
 * User/tenant context for personalized recommendations
 */
export interface RecommendationUserContext {
  userId?: string
  tenantId?: string
  organizationId?: string
  /** Display name for personalization (e.g. "Roche-User") */
  tenantName?: string
}

/**
 * Recommendation generation configuration
 */
export interface RecommendationConfig {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number
  /** Maximum recommendations to generate */
  maxRecommendations?: number
  /** Include low-priority recommendations */
  includeLowPriority?: boolean
  /** Categories to include */
  categories?: EnhancedRecommendation['category'][]
  /** Optional user/tenant context for personalized recommendation text */
  userContext?: RecommendationUserContext
}

const DEFAULT_CONFIG: RecommendationConfig = {
  minConfidence: 0.5,
  maxRecommendations: 10,
  includeLowPriority: false,
  categories: ['budget', 'vendor', 'timeline', 'risk', 'optimization']
}

/**
 * Generate smart recommendations based on project data and anomalies
 */
function personalizeTitle(title: string, userContext?: RecommendationUserContext): string {
  if (!userContext?.tenantName) return title
  return `For ${userContext.tenantName}: ${title}`
}

function personalizeDescription(description: string, userContext?: RecommendationUserContext): string {
  if (!userContext?.tenantName) return description
  return description
}

export function generateRecommendations(
  projects: ProjectWithFinancials[],
  anomalies: AnomalyResult[] = [],
  config: RecommendationConfig = {}
): EnhancedRecommendation[] {
  const { minConfidence, maxRecommendations, includeLowPriority, categories, userContext } = {
    ...DEFAULT_CONFIG,
    ...config
  }

  const recommendations: EnhancedRecommendation[] = []

  // Generate budget reallocation recommendations
  if (categories.includes('budget')) {
    recommendations.push(...generateBudgetRecommendations(projects))
  }

  // Generate vendor optimization recommendations
  if (categories.includes('vendor')) {
    recommendations.push(...generateVendorRecommendations(projects))
  }

  // Generate timeline recommendations
  if (categories.includes('timeline')) {
    recommendations.push(...generateTimelineRecommendations(projects))
  }

  // Generate risk-based recommendations from anomalies
  if (categories.includes('risk')) {
    recommendations.push(...generateRiskRecommendations(projects, anomalies))
  }

  // Generate optimization recommendations
  if (categories.includes('optimization')) {
    recommendations.push(...generateOptimizationRecommendations(projects))
  }

  // Filter by confidence
  let filtered = recommendations.filter(r => r.confidence_score >= minConfidence)

  // Filter low priority if not included
  if (!includeLowPriority) {
    filtered = filtered.filter(r => r.priority >= 30)
  }

  // Sort by priority (descending)
  filtered.sort((a, b) => b.priority - a.priority)

  // Apply personalization labels when userContext is provided
  const limited = filtered.slice(0, maxRecommendations)
  if (userContext?.tenantName) {
    return limited.map(r => ({
      ...r,
      title: personalizeTitle(r.title, userContext),
      description: r.description,
    }))
  }
  return limited
}

/**
 * Generate budget reallocation recommendations
 */
function generateBudgetRecommendations(projects: ProjectWithFinancials[]): EnhancedRecommendation[] {
  const recommendations: EnhancedRecommendation[] = []
  
  // Find projects significantly under budget that could reallocate funds
  const underBudgetProjects = projects.filter(p => 
    p.variance > p.budget * 0.2 && 
    p.status === ProjectStatus.ACTIVE &&
    p.spend_percentage > 50 // More than halfway through
  )
  
  // Find projects over budget that need funds
  const overBudgetProjects = projects.filter(p => 
    p.variance < 0 && 
    p.status === ProjectStatus.ACTIVE
  )
  
  // Generate reallocation recommendations
  for (const underProject of underBudgetProjects) {
    for (const overProject of overBudgetProjects) {
      const surplusAvailable = Math.min(underProject.variance * 0.5, Math.abs(overProject.variance))
      
      if (surplusAvailable > 10000) { // Only recommend if significant
        recommendations.push({
          id: `budget-realloc-${underProject.id}-${overProject.id}`,
          project_id: underProject.id,
          type: 'budget_reallocation',
          title: `Reallocate funds from ${underProject.name}`,
          description: `${underProject.name} has significant budget surplus. Consider reallocating ${formatCurrency(surplusAvailable)} to ${overProject.name} which is over budget by ${formatCurrency(Math.abs(overProject.variance))}.`,
          impact_amount: surplusAvailable,
          confidence_score: 0.75,
          action_required: true,
          created_at: new Date().toISOString(),
          priority: calculatePriority(surplusAvailable, overProject.health_score),
          category: 'budget',
          relatedProjects: [underProject.id, overProject.id],
          supportingData: [
            { metric: 'Surplus Available', value: underProject.variance, unit: 'USD', trend: 'stable' },
            { metric: 'Deficit to Cover', value: Math.abs(overProject.variance), unit: 'USD', trend: 'down' },
            { metric: 'Under-budget Health', value: underProject.health_score, unit: '%' },
            { metric: 'Over-budget Health', value: overProject.health_score, unit: '%' }
          ],
          risks: [
            `${overProject.name} may exceed budget further without intervention`,
            'Delayed reallocation could impact project delivery'
          ],
          status: 'pending'
        })
      }
    }
  }

  // Add recommendation for projects significantly over budget
  for (const project of overBudgetProjects) {
    if (Math.abs(project.variance) > project.budget * 0.15) {
      recommendations.push({
        id: `budget-review-${project.id}`,
        project_id: project.id,
        type: 'budget_reallocation',
        title: `Budget review required for ${project.name}`,
        description: `Project is ${((Math.abs(project.variance) / project.budget) * 100).toFixed(1)}% over budget. Immediate review recommended to identify cost reduction opportunities or request additional funding.`,
        impact_amount: Math.abs(project.variance),
        confidence_score: 0.85,
        action_required: true,
        created_at: new Date().toISOString(),
        priority: 80,
        category: 'budget',
        relatedProjects: [project.id],
        supportingData: [
          { metric: 'Budget Overrun', value: Math.abs(project.variance), unit: 'USD', trend: 'down' },
          { metric: 'Overrun Percentage', value: (Math.abs(project.variance) / project.budget) * 100, unit: '%' },
          { metric: 'Health Score', value: project.health_score, unit: '%', trend: 'down' }
        ],
        risks: [
          'Project may require emergency funding',
          'Stakeholder confidence may be affected',
          'Delivery timeline could be impacted'
        ],
        status: 'pending'
      })
    }
  }

  return recommendations
}

/**
 * Generate vendor optimization recommendations
 */
function generateVendorRecommendations(projects: ProjectWithFinancials[]): EnhancedRecommendation[] {
  const recommendations: EnhancedRecommendation[] = []
  
  // Analyze vendor concentration across projects
  // In a real implementation, this would analyze actual vendor data
  // For now, we'll generate general vendor optimization recommendations
  
  const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE)
  const totalSpend = activeProjects.reduce((sum, p) => sum + p.total_spend, 0)
  
  if (activeProjects.length >= 3 && totalSpend > 500000) {
    recommendations.push({
      id: 'vendor-consolidation-review',
      project_id: activeProjects[0].id,
      type: 'vendor_optimization',
      title: 'Vendor consolidation opportunity',
      description: `With ${activeProjects.length} active projects and ${formatCurrency(totalSpend)} in total spend, consider reviewing vendor contracts for consolidation opportunities. Bulk purchasing could yield 5-15% savings.`,
      impact_amount: totalSpend * 0.08, // Estimate 8% savings
      confidence_score: 0.6,
      action_required: false,
      created_at: new Date().toISOString(),
      priority: 50,
      category: 'vendor',
      relatedProjects: activeProjects.map(p => p.id),
      supportingData: [
        { metric: 'Total Active Spend', value: totalSpend, unit: 'USD' },
        { metric: 'Active Projects', value: activeProjects.length, unit: 'count' },
        { metric: 'Estimated Savings', value: totalSpend * 0.08, unit: 'USD' }
      ],
      risks: [
        'Vendor consolidation requires procurement team involvement',
        'Contract renegotiation may take time'
      ],
      status: 'pending'
    })
  }

  // Find projects with high commitment-to-actual ratio
  for (const project of activeProjects) {
    const commitmentRatio = project.total_commitments / (project.total_actuals + 1)
    
    if (commitmentRatio > 2 && project.total_commitments > 50000) {
      recommendations.push({
        id: `vendor-commitment-${project.id}`,
        project_id: project.id,
        type: 'vendor_optimization',
        title: `Review pending commitments for ${project.name}`,
        description: `High ratio of commitments to actuals (${commitmentRatio.toFixed(1)}x) suggests many POs are pending delivery. Review vendor performance and consider expediting critical items.`,
        impact_amount: project.total_commitments - project.total_actuals,
        confidence_score: 0.7,
        action_required: true,
        created_at: new Date().toISOString(),
        priority: 60,
        category: 'vendor',
        relatedProjects: [project.id],
        supportingData: [
          { metric: 'Pending Commitments', value: project.total_commitments - project.total_actuals, unit: 'USD' },
          { metric: 'Commitment/Actual Ratio', value: commitmentRatio, unit: 'x' },
          { metric: 'Total Commitments', value: project.total_commitments, unit: 'USD' }
        ],
        risks: [
          'Delivery delays may impact project timeline',
          'Cash flow may be affected by large outstanding commitments'
        ],
        status: 'pending'
      })
    }
  }

  return recommendations
}

/**
 * Generate timeline-based recommendations
 */
function generateTimelineRecommendations(projects: ProjectWithFinancials[]): EnhancedRecommendation[] {
  const recommendations: EnhancedRecommendation[] = []
  const now = new Date()
  
  for (const project of projects) {
    if (project.status !== ProjectStatus.ACTIVE) continue
    
    const endDate = new Date(project.end_date)
    const startDate = new Date(project.start_date)
    const totalDuration = endDate.getTime() - startDate.getTime()
    const elapsed = now.getTime() - startDate.getTime()
    const timeProgress = Math.max(0, Math.min(1, elapsed / totalDuration))
    
    // Check for timeline vs budget misalignment
    const spendProgress = project.spend_percentage / 100
    const progressDifference = Math.abs(timeProgress - spendProgress)
    
    if (progressDifference > 0.2) { // More than 20% difference
      if (spendProgress > timeProgress + 0.2) {
        // Spending ahead of schedule
        recommendations.push({
          id: `timeline-overspend-${project.id}`,
          project_id: project.id,
          type: 'timeline_adjustment',
          title: `Spending ahead of schedule: ${project.name}`,
          description: `Project has spent ${(spendProgress * 100).toFixed(0)}% of budget but only ${(timeProgress * 100).toFixed(0)}% through timeline. Consider reviewing spend rate or accelerating delivery to match.`,
          impact_amount: project.budget * progressDifference,
          confidence_score: 0.7,
          action_required: true,
          created_at: new Date().toISOString(),
          priority: 65,
          category: 'timeline',
          relatedProjects: [project.id],
          supportingData: [
            { metric: 'Budget Progress', value: spendProgress * 100, unit: '%', trend: 'up' },
            { metric: 'Timeline Progress', value: timeProgress * 100, unit: '%' },
            { metric: 'Difference', value: progressDifference * 100, unit: '%' }
          ],
          risks: [
            'May run out of budget before project completion',
            'Cash flow timing issues possible'
          ],
          status: 'pending'
        })
      } else if (timeProgress > spendProgress + 0.2) {
        // Spending behind schedule
        recommendations.push({
          id: `timeline-underspend-${project.id}`,
          project_id: project.id,
          type: 'timeline_adjustment',
          title: `Spending behind schedule: ${project.name}`,
          description: `Project is ${(timeProgress * 100).toFixed(0)}% through timeline but only ${(spendProgress * 100).toFixed(0)}% spent. This may indicate delays or scope changes. Review project status.`,
          impact_amount: project.budget * progressDifference,
          confidence_score: 0.65,
          action_required: false,
          created_at: new Date().toISOString(),
          priority: 45,
          category: 'timeline',
          relatedProjects: [project.id],
          supportingData: [
            { metric: 'Timeline Progress', value: timeProgress * 100, unit: '%' },
            { metric: 'Budget Progress', value: spendProgress * 100, unit: '%', trend: 'stable' },
            { metric: 'Difference', value: progressDifference * 100, unit: '%' }
          ],
          risks: [
            'Project may be delayed',
            'Year-end budget utilization may be affected'
          ],
          status: 'pending'
        })
      }
    }
    
    // Check for projects nearing end date
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysRemaining > 0 && daysRemaining <= 30 && spendProgress < 0.8) {
      recommendations.push({
        id: `timeline-ending-${project.id}`,
        project_id: project.id,
        type: 'timeline_adjustment',
        title: `Project ending soon: ${project.name}`,
        description: `Only ${daysRemaining} days remaining but ${((1 - spendProgress) * 100).toFixed(0)}% of budget unspent. Review remaining deliverables and accelerate if needed.`,
        impact_amount: project.budget * (1 - spendProgress),
        confidence_score: 0.8,
        action_required: true,
        created_at: new Date().toISOString(),
        priority: 75,
        category: 'timeline',
        relatedProjects: [project.id],
        supportingData: [
          { metric: 'Days Remaining', value: daysRemaining, unit: 'days' },
          { metric: 'Unspent Budget', value: project.budget * (1 - spendProgress), unit: 'USD' },
          { metric: 'Completion', value: spendProgress * 100, unit: '%' }
        ],
        risks: [
          'May not complete all deliverables',
          'Budget may be lost if not utilized'
        ],
        status: 'pending'
      })
    }
  }

  return recommendations
}

/**
 * Generate risk-based recommendations from anomalies
 */
function generateRiskRecommendations(
  projects: ProjectWithFinancials[],
  anomalies: AnomalyResult[]
): EnhancedRecommendation[] {
  const recommendations: EnhancedRecommendation[] = []
  
  // Group anomalies by project
  const anomaliesByProject = new Map<string, AnomalyResult[]>()
  for (const anomaly of anomalies) {
    const existing = anomaliesByProject.get(anomaly.projectId) || []
    existing.push(anomaly)
    anomaliesByProject.set(anomaly.projectId, existing)
  }
  
  // Generate recommendations for projects with multiple anomalies
  for (const [projectId, projectAnomalies] of anomaliesByProject) {
    const project = projects.find(p => p.id === projectId)
    if (!project) continue
    
    const criticalCount = projectAnomalies.filter(a => a.severity === 'critical').length
    const highCount = projectAnomalies.filter(a => a.severity === 'high').length
    
    if (criticalCount > 0 || highCount >= 2) {
      recommendations.push({
        id: `risk-multi-anomaly-${projectId}`,
        project_id: projectId,
        type: 'budget_reallocation', // Using existing type
        title: `Multiple risk indicators: ${project.name}`,
        description: `Project has ${criticalCount} critical and ${highCount} high-severity anomalies detected. Immediate review recommended.`,
        impact_amount: Math.abs(project.variance),
        confidence_score: 0.9,
        action_required: true,
        created_at: new Date().toISOString(),
        priority: 90,
        category: 'risk',
        relatedProjects: [projectId],
        supportingData: [
          { metric: 'Critical Anomalies', value: criticalCount, unit: 'count' },
          { metric: 'High Anomalies', value: highCount, unit: 'count' },
          { metric: 'Health Score', value: project.health_score, unit: '%', trend: 'down' },
          { metric: 'Variance', value: project.variance, unit: 'USD' }
        ],
        risks: projectAnomalies.map(a => a.description),
        status: 'pending'
      })
    }
    
    // Generate specific recommendations for variance outliers
    const varianceAnomalies = projectAnomalies.filter(
      a => a.anomalyType === AnomalyType.VARIANCE_OUTLIER
    )
    
    for (const anomaly of varianceAnomalies) {
      recommendations.push({
        id: `risk-variance-${projectId}-${anomaly.anomalyType}`,
        project_id: projectId,
        type: 'budget_reallocation',
        title: `Variance anomaly: ${project.name}`,
        description: anomaly.description + (anomaly.recommendation ? ` ${anomaly.recommendation}` : ''),
        impact_amount: Math.abs(anomaly.details.actualValue),
        confidence_score: anomaly.confidence,
        action_required: anomaly.severity === 'critical' || anomaly.severity === 'high',
        created_at: new Date().toISOString(),
        priority: anomaly.severity === 'critical' ? 85 : anomaly.severity === 'high' ? 70 : 50,
        category: 'risk',
        relatedProjects: [projectId],
        supportingData: [
          { metric: 'Actual Value', value: anomaly.details.actualValue, unit: 'USD' },
          ...(anomaly.details.expectedValue !== undefined 
            ? [{ metric: 'Expected Value', value: anomaly.details.expectedValue, unit: 'USD' }] 
            : []),
          ...(anomaly.details.zScore !== undefined 
            ? [{ metric: 'Z-Score', value: anomaly.details.zScore, unit: 'σ' }] 
            : [])
        ],
        risks: [anomaly.description],
        status: 'pending'
      })
    }
  }

  return recommendations
}

/**
 * Generate optimization recommendations
 */
function generateOptimizationRecommendations(projects: ProjectWithFinancials[]): EnhancedRecommendation[] {
  const recommendations: EnhancedRecommendation[] = []
  
  // Find projects with healthy metrics that could be models
  const healthyProjects = projects.filter(p => 
    p.health_score >= 80 && 
    p.variance >= 0 && 
    p.status === ProjectStatus.ACTIVE
  )
  
  // Find struggling projects
  const strugglingProjects = projects.filter(p =>
    p.health_score < 50 ||
    p.variance < -p.budget * 0.1
  )
  
  if (healthyProjects.length > 0 && strugglingProjects.length > 0) {
    recommendations.push({
      id: 'optimization-best-practices',
      project_id: healthyProjects[0].id,
      type: 'vendor_optimization',
      title: 'Best practices sharing opportunity',
      description: `${healthyProjects.length} projects are performing well while ${strugglingProjects.length} are struggling. Consider organizing a knowledge sharing session to transfer best practices.`,
      impact_amount: strugglingProjects.reduce((sum, p) => sum + Math.abs(Math.min(0, p.variance)), 0) * 0.3,
      confidence_score: 0.55,
      action_required: false,
      created_at: new Date().toISOString(),
      priority: 35,
      category: 'optimization',
      relatedProjects: [...healthyProjects.map(p => p.id), ...strugglingProjects.map(p => p.id)],
      supportingData: [
        { metric: 'High-performing Projects', value: healthyProjects.length, unit: 'count' },
        { metric: 'Struggling Projects', value: strugglingProjects.length, unit: 'count' },
        { metric: 'Avg Healthy Score', value: healthyProjects.reduce((s, p) => s + p.health_score, 0) / healthyProjects.length, unit: '%' },
        { metric: 'Avg Struggling Score', value: strugglingProjects.reduce((s, p) => s + p.health_score, 0) / strugglingProjects.length, unit: '%' }
      ],
      risks: [
        'Knowledge may not transfer directly between project types',
        'Requires coordination effort'
      ],
      status: 'pending'
    })
  }

  // Portfolio-level health optimization
  const avgHealth = projects.reduce((sum, p) => sum + p.health_score, 0) / projects.length
  
  if (avgHealth < 60 && projects.length >= 3) {
    recommendations.push({
      id: 'optimization-portfolio-health',
      project_id: projects[0].id,
      type: 'budget_reallocation',
      title: 'Portfolio health review needed',
      description: `Average portfolio health score is ${avgHealth.toFixed(0)}%, which is below optimal. Consider a comprehensive review of project management practices.`,
      impact_amount: projects.reduce((sum, p) => sum + p.budget, 0) * 0.05,
      confidence_score: 0.65,
      action_required: true,
      created_at: new Date().toISOString(),
      priority: 55,
      category: 'optimization',
      relatedProjects: projects.map(p => p.id),
      supportingData: [
        { metric: 'Average Health', value: avgHealth, unit: '%', trend: 'down' },
        { metric: 'Total Projects', value: projects.length, unit: 'count' },
        { metric: 'Below 50% Health', value: projects.filter(p => p.health_score < 50).length, unit: 'count' }
      ],
      risks: [
        'Systemic issues may be affecting multiple projects',
        'Resource constraints may be common factor'
      ],
      status: 'pending'
    })
  }

  return recommendations
}

/**
 * Calculate priority score based on impact and urgency
 */
function calculatePriority(impactAmount: number, healthScore: number): number {
  // Higher impact = higher priority
  const impactScore = Math.min(50, Math.log10(Math.max(1, impactAmount)) * 10)
  
  // Lower health = higher priority
  const urgencyScore = Math.max(0, (100 - healthScore) / 2)
  
  return Math.round(impactScore + urgencyScore)
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Get recommendations summary
 */
export function getRecommendationsSummary(recommendations: EnhancedRecommendation[]): {
  total: number
  byCategory: Record<EnhancedRecommendation['category'], number>
  totalImpact: number
  actionRequired: number
  highPriority: number
} {
  const byCategory: Record<EnhancedRecommendation['category'], number> = {
    budget: 0,
    vendor: 0,
    timeline: 0,
    risk: 0,
    optimization: 0
  }
  
  let totalImpact = 0
  let actionRequired = 0
  let highPriority = 0
  
  for (const rec of recommendations) {
    byCategory[rec.category]++
    totalImpact += rec.impact_amount
    if (rec.action_required) actionRequired++
    if (rec.priority >= 70) highPriority++
  }
  
  return {
    total: recommendations.length,
    byCategory,
    totalImpact,
    actionRequired,
    highPriority
  }
}

/**
 * Filter recommendations by status
 */
export function filterRecommendationsByStatus(
  recommendations: EnhancedRecommendation[],
  statuses: EnhancedRecommendation['status'][]
): EnhancedRecommendation[] {
  return recommendations.filter(r => statuses.includes(r.status))
}

/**
 * Update recommendation status
 */
export function updateRecommendationStatus(
  recommendations: EnhancedRecommendation[],
  id: string,
  status: EnhancedRecommendation['status']
): EnhancedRecommendation[] {
  return recommendations.map(r => 
    r.id === id ? { ...r, status } : r
  )
}

// Task 43.5: Recommendation learning - track user feedback for algorithm adjustment
export interface RecommendationFeedbackRecord {
  recommendationId: string
  category: EnhancedRecommendation['category']
  status: EnhancedRecommendation['status']
  timestamp: string
}

const feedbackStore: RecommendationFeedbackRecord[] = []

/**
 * Record user feedback on a recommendation (accept/reject/defer).
 * Used to adjust recommendation algorithm over time (Phase 3).
 */
export function recordRecommendationFeedback(
  recommendationId: string,
  category: EnhancedRecommendation['category'],
  status: EnhancedRecommendation['status']
): void {
  feedbackStore.push({
    recommendationId,
    category,
    status,
    timestamp: new Date().toISOString()
  })
}

/**
 * Get feedback stats per category (for learning / tuning).
 */
export function getRecommendationFeedbackStats(): Record<string, { accepted: number; rejected: number; deferred: number }> {
  const stats: Record<string, { accepted: number; rejected: number; deferred: number }> = {}
  for (const f of feedbackStore) {
    if (!stats[f.category]) stats[f.category] = { accepted: 0, rejected: 0, deferred: 0 }
    if (f.status === 'accepted') stats[f.category].accepted++
    else if (f.status === 'rejected') stats[f.category].rejected++
    else if (f.status === 'deferred') stats[f.category].deferred++
  }
  return stats
}

export default generateRecommendations
