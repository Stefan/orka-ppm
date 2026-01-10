import { NextRequest, NextResponse } from 'next/server'

// Mock proactive tips data
const MOCK_TIPS = [
  {
    id: 'tip-1',
    title: 'Dashboard Optimization',
    content: 'Consider using the AI-enhanced dashboard view for better insights into your project performance.',
    type: 'feature' as const,
    priority: 'medium' as const,
    context: '/dashboard',
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
    ]
  },
  {
    id: 'tip-2',
    title: 'Cross-Device Sync',
    content: 'Your dashboard preferences are now synced across all your devices. Changes made here will appear on your other devices.',
    type: 'info' as const,
    priority: 'low' as const,
    context: '/dashboard',
    actions: [
      {
        label: 'View Devices',
        action: 'view_devices',
        primary: true
      }
    ]
  },
  {
    id: 'tip-3',
    title: 'Performance Insights',
    content: 'Your projects are performing well! Consider reviewing the variance alerts to optimize budget allocation.',
    type: 'success' as const,
    priority: 'medium' as const,
    context: '/dashboard',
    actions: [
      {
        label: 'View Alerts',
        action: 'view_variance_alerts',
        primary: true
      }
    ]
  }
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { context } = body
    
    // Filter tips based on context
    const contextualTips = MOCK_TIPS.filter(tip => 
      !context || tip.context === context || tip.context === 'global'
    )
    
    // Sort by priority (high -> medium -> low)
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    const sortedTips = contextualTips.sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    )
    
    return NextResponse.json({
      tips: sortedTips.slice(0, 3), // Return max 3 tips
      context,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    })
  } catch (error) {
    console.error('Tips API error:', error)
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
    const context = searchParams.get('context')
    
    // Filter tips based on context
    const contextualTips = MOCK_TIPS.filter(tip => 
      !context || tip.context === context || tip.context === 'global'
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
    console.error('Tips API error:', error)
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