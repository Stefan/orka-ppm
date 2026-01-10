/**
 * Dashboard Quick Stats API Endpoint
 * Provides mock data for dashboard functionality
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Mock dashboard data to prevent "Failed to fetch" errors
    const mockData = {
      quick_stats: {
        total_projects: 12,
        active_projects: 8,
        completed_projects: 4,
        health_distribution: {
          green: 6,
          yellow: 4,
          red: 2
        },
        critical_alerts: 2,
        at_risk_projects: 4,
        total_budget: 2500000,
        spent_budget: 1800000,
        team_members: 24,
        pending_tasks: 156,
        overdue_tasks: 12
      },
      kpis: {
        project_success_rate: 85,
        budget_utilization: 72,
        team_productivity: 78,
        risk_score: 23,
        schedule_performance: 91,
        cost_performance: 88
      },
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
    
    return NextResponse.json(mockData, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({
      error: 'Failed to load dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}