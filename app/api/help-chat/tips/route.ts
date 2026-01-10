/**
 * Help Chat Tips API Endpoint
 * Provides proactive tips based on context
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock proactive tips data
const MOCK_TIPS = [
  {
    id: 'tip-1',
    title: 'Dashboard Optimization',
    content: 'Consider using the AI-enhanced dashboard view for better insights into your project performance.',
    type: 'feature' as const,
    priority: 'medium' as const,
    triggerContext: '/dashboards',
    actions: [
      {
        label: 'Switch to AI View',
        action: 'switch_dashboard_mode',
        primary: true
      },
      {
        label: 'Learn More',
        action: 'open_help',
        primary: false
      }
    ],
    dismissible: true,
    showOnce: false
  },
  {
    id: 'tip-2',
    title: 'Cross-Device Sync',
    content: 'Your dashboard preferences are now synced across all your devices. Changes made here will appear on your other devices.',
    type: 'info' as const,
    priority: 'low' as const,
    triggerContext: '/dashboards',
    actions: [
      {
        label: 'View Devices',
        action: 'view_devices',
        primary: true
      }
    ],
    dismissible: true,
    showOnce: true
  },
  {
    id: 'tip-3',
    title: 'Performance Insights',
    content: 'Your projects are performing well! Consider reviewing the variance alerts to optimize budget allocation.',
    type: 'success' as const,
    priority: 'medium' as const,
    triggerContext: '/dashboards',
    actions: [
      {
        label: 'View Alerts',
        action: 'view_variance_alerts',
        primary: true
      }
    ],
    dismissible: true,
    showOnce: false
  },
  {
    id: 'tip-4',
    title: 'Mobile Optimization',
    content: 'The interface is now optimized for mobile devices with touch-friendly controls and responsive design.',
    type: 'feature' as const,
    priority: 'low' as const,
    triggerContext: 'mobile',
    actions: [
      {
        label: 'Explore Mobile Features',
        action: 'mobile_tour',
        primary: true
      }
    ],
    dismissible: true,
    showOnce: true
  }
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { context } = body
    
    // Parse context parameters if it's a query string
    let contextParams: Record<string, string> = {}
    if (typeof context === 'string' && context.includes('=')) {
      const params = new URLSearchParams(context)
      contextParams = Object.fromEntries(params.entries())
    }
    
    const currentPage = contextParams.current_page || context || '/dashboards'
    const userAgent = contextParams.user_agent || ''
    const isMobile = userAgent.toLowerCase().includes('mobile') || 
                    userAgent.toLowerCase().includes('android') ||
                    userAgent.toLowerCase().includes('iphone')
    
    // Filter tips based on context
    let contextualTips = MOCK_TIPS.filter(tip => {
      if (tip.triggerContext === 'mobile' && !isMobile) return false
      if (tip.triggerContext !== 'mobile' && tip.triggerContext !== currentPage && tip.triggerContext !== 'global') return false
      return true
    })
    
    // Sort by priority (high -> medium -> low)
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    contextualTips = contextualTips.sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    )
    
    return NextResponse.json({
      tips: contextualTips.slice(0, 3), // Return max 3 tips
      context: currentPage,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    })
  } catch (error) {
    console.error('Help chat tips error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch proactive tips',
        tips: [],
        context: null,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const context = searchParams.get('context') || '/dashboards'
    
    // Filter tips based on context
    const contextualTips = MOCK_TIPS.filter(tip => 
      tip.triggerContext === context || tip.triggerContext === 'global'
    )
    
    return NextResponse.json({
      tips: contextualTips,
      context,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('Help chat tips error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch proactive tips',
        tips: [],
        context: null,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}