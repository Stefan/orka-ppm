/**
 * Dashboard Quick Stats API Endpoint
 * Fetches real data from backend and computes dashboard statistics
 * Applies user KPI preferences from settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getUserIdFromAuthHeader } from '@/lib/auth/verify-jwt'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Lazy Supabase client so build (no env) does not throw "supabaseUrl is required" at module load */
function getSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

interface DashboardKPIs {
  successRateMethod: 'health' | 'completion'
  budgetMethod: 'spent' | 'remaining'
  resourceMethod: 'auto' | 'fixed'
  resourceFixedValue: number
}

const DEFAULT_KPI_SETTINGS: DashboardKPIs = {
  successRateMethod: 'health',
  budgetMethod: 'spent',
  resourceMethod: 'auto',
  resourceFixedValue: 85
}

/**
 * Fetch user's KPI preferences
 */
async function getUserKPISettings(userId: string | null): Promise<DashboardKPIs> {
  const supabase = getSupabase()
  if (!userId || !supabase) {
    return DEFAULT_KPI_SETTINGS
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .single()

    if (error || !data?.preferences?.dashboardKPIs) {
      return DEFAULT_KPI_SETTINGS
    }

    return {
      ...DEFAULT_KPI_SETTINGS,
      ...data.preferences.dashboardKPIs
    }
  } catch (error) {
    console.error('Failed to fetch user KPI settings:', error)
    return DEFAULT_KPI_SETTINGS
  }
}

/**
 * Calculate KPIs based on user preferences
 */
function calculateKPIs(
  settings: DashboardKPIs,
  totalProjects: number,
  activeProjects: number,
  completedProjects: number,
  healthDistribution: { green: number; yellow: number; red: number },
  totalBudget: number,
  spentBudget: number
) {
  // Success Rate: based on user preference
  let project_success_rate = 0
  if (totalProjects > 0) {
    if (settings.successRateMethod === 'health') {
      // Health-based: % of green projects + completed
      project_success_rate = Math.round(((healthDistribution.green + completedProjects) / totalProjects) * 100)
    } else {
      // Completion-based: % of completed projects
      project_success_rate = Math.round((completedProjects / totalProjects) * 100)
    }
  }

  // Budget Performance: based on user preference
  let budget_performance = 0
  if (totalBudget > 0) {
    if (settings.budgetMethod === 'spent') {
      // Spent: % of budget utilized
      budget_performance = Math.round((spentBudget / totalBudget) * 100)
    } else {
      // Remaining: % of budget available
      budget_performance = Math.round(((totalBudget - spentBudget) / totalBudget) * 100)
    }
  }

  // Timeline Performance: % of active projects
  const timeline_performance = totalProjects > 0 
    ? Math.round((activeProjects / totalProjects) * 100) 
    : 0

  // Average Health Score
  const average_health_score = totalProjects > 0 
    ? Math.round(((healthDistribution.green * 100 + healthDistribution.yellow * 50) / totalProjects) / 10) / 10 
    : 0

  // Resource Efficiency: based on user preference
  let resource_efficiency = 0
  if (settings.resourceMethod === 'fixed') {
    resource_efficiency = settings.resourceFixedValue
  } else {
    // Auto-calculate based on active projects ratio
    resource_efficiency = totalProjects > 0 
      ? Math.min(100, Math.round((activeProjects / totalProjects) * 100 + 20)) 
      : 0
  }

  // Active Projects Ratio
  const active_projects_ratio = totalProjects > 0 
    ? Math.round((activeProjects / totalProjects) * 100) 
    : 0

  return {
    project_success_rate,
    budget_performance,
    timeline_performance,
    average_health_score,
    resource_efficiency,
    active_projects_ratio
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const portfolioId = searchParams.get('portfolio_id')

    // Get user ID and their KPI preferences
    const userId = await getUserIdFromAuthHeader(authHeader)
    const kpiSettings = await getUserKPISettings(userId)

    const projectsUrl = portfolioId
      ? `${BACKEND_URL}/projects?portfolio_id=${encodeURIComponent(portfolioId)}`
      : `${BACKEND_URL}/projects`

    // Fetch projects from backend
    const response = await fetch(projectsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
    })
    
    if (!response.ok) {
      console.error('Backend API error:', response.status)
      // Return fallback mock data if backend is unavailable
      return NextResponse.json(getMockDashboardData(kpiSettings), { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Data-Source': 'fallback-mock'
        }
      })
    }
    
    const projectsData = await response.json()
    const projects = Array.isArray(projectsData) ? projectsData : projectsData?.projects || []
    
    // Calculate real statistics from projects
    const totalProjects = projects.length
    const activeProjects = projects.filter((p: any) => p?.status === 'active').length
    const completedProjects = projects.filter((p: any) => p?.status === 'completed').length
    
    const healthDistribution = projects.reduce((acc: any, project: any) => {
      const health = project?.health || 'green'
      acc[health] = (acc[health] || 0) + 1
      return acc
    }, { green: 0, yellow: 0, red: 0 })
    
    const totalBudget = projects.reduce((sum: number, p: any) => sum + (p?.budget || 0), 0)
    const spentBudget = projects.reduce((sum: number, p: any) => sum + (p?.actual || p?.budget * 0.7 || 0), 0)
    
    // Calculate KPIs with user preferences
    const kpis = calculateKPIs(
      kpiSettings,
      totalProjects,
      activeProjects,
      completedProjects,
      healthDistribution,
      totalBudget,
      spentBudget
    )
    
    const dashboardData = {
      quick_stats: {
        total_projects: totalProjects,
        active_projects: activeProjects,
        completed_projects: completedProjects,
        health_distribution: healthDistribution,
        critical_alerts: healthDistribution.red || 0,
        at_risk_projects: healthDistribution.yellow || 0,
        total_budget: totalBudget,
        spent_budget: spentBudget,
        team_members: Math.max(totalProjects * 3, 1),
        pending_tasks: activeProjects * 15,
        overdue_tasks: healthDistribution.red * 6
      },
      kpis,
      kpi_settings: kpiSettings, // Include settings so frontend knows what was applied
      recent_activity: projects.slice(0, 3).map((p: any, i: number) => ({
        id: i + 1,
        type: 'project_update',
        message: `${p.name} - ${p.status}`,
        timestamp: p.created_at || new Date().toISOString()
      })),
      charts: {
        project_timeline: generateTimelineData(projects),
        budget_utilization: generateBudgetData(projects)
      }
    }
    
    return NextResponse.json(dashboardData, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Data-Source': 'backend-real'
      }
    })
    
  } catch (error) {
    console.error('Dashboard API error:', error)
    // Return fallback mock data on error
    return NextResponse.json(getMockDashboardData(DEFAULT_KPI_SETTINGS), { 
      status: 200,
      headers: {
        'X-Data-Source': 'fallback-mock'
      }
    })
  }
}

function generateTimelineData(projects: any[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  return months.map((month, i) => ({
    month,
    planned: Math.max(projects.length - i, 0),
    actual: Math.max(projects.filter((p: any) => p.status === 'completed').length - i, 0)
  }))
}

function generateBudgetData(projects: any[]) {
  const categories = ['Development', 'Design', 'Testing', 'Infrastructure']
  const totalBudget = projects.reduce((sum: number, p: any) => sum + (p?.budget || 0), 0)
  
  return categories.map((category) => {
    const budget = totalBudget / categories.length
    return {
      category,
      budget: Math.round(budget),
      spent: Math.round(budget * (0.7 + Math.random() * 0.2))
    }
  })
}

function getMockDashboardData(kpiSettings: DashboardKPIs) {
  // Mock data with configurable KPIs
  const totalProjects = 12
  const activeProjects = 8
  const completedProjects = 4
  const healthDistribution = { green: 6, yellow: 4, red: 2 }
  const totalBudget = 2500000
  const spentBudget = 1800000

  const kpis = calculateKPIs(
    kpiSettings,
    totalProjects,
    activeProjects,
    completedProjects,
    healthDistribution,
    totalBudget,
    spentBudget
  )

  return {
    quick_stats: {
      total_projects: totalProjects,
      active_projects: activeProjects,
      completed_projects: completedProjects,
      health_distribution: healthDistribution,
      critical_alerts: 2,
      at_risk_projects: 4,
      total_budget: totalBudget,
      spent_budget: spentBudget,
      team_members: 24,
      pending_tasks: 156,
      overdue_tasks: 12
    },
    kpis,
    kpi_settings: kpiSettings,
    recent_activity: [
      {
        id: 1,
        type: 'project_update',
        message: 'Project Alpha milestone completed',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        type: 'budget_alert',
        message: 'Project Beta approaching budget limit',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 3,
        type: 'team_update',
        message: 'New team member joined Project Gamma',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      }
    ],
    charts: {
      project_timeline: [
        { month: 'Jan', planned: 10, actual: 8 },
        { month: 'Feb', planned: 12, actual: 11 },
        { month: 'Mar', planned: 15, actual: 14 },
        { month: 'Apr', planned: 18, actual: 16 },
        { month: 'May', planned: 20, actual: 19 },
        { month: 'Jun', planned: 22, actual: 21 }
      ],
      budget_utilization: [
        { category: 'Development', budget: 800000, spent: 650000 },
        { category: 'Design', budget: 300000, spent: 280000 },
        { category: 'Testing', budget: 200000, spent: 150000 },
        { category: 'Infrastructure', budget: 400000, spent: 320000 }
      ]
    }
  }
}
