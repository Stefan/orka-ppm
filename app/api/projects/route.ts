import { NextRequest, NextResponse } from 'next/server'

// Mock project data
const MOCK_PROJECTS = [
  {
    "id": "1",
    "name": "Office Complex Phase 1",
    "status": "active",
    "health": "green",
    "budget": 150000,
    "created_at": "2024-01-15T10:00:00Z"
  },
  {
    "id": "2",
    "name": "Residential Tower A",
    "status": "active",
    "health": "yellow",
    "budget": 200000,
    "created_at": "2024-01-20T10:00:00Z"
  },
  {
    "id": "3",
    "name": "Shopping Center Renovation",
    "status": "active",
    "health": "red",
    "budget": 80000,
    "created_at": "2024-02-01T10:00:00Z"
  },
  {
    "id": "4",
    "name": "Parking Garage Construction",
    "status": "active",
    "health": "green",
    "budget": 120000,
    "created_at": "2024-02-10T10:00:00Z"
  },
  {
    "id": "5",
    "name": "Landscape Development",
    "status": "active",
    "health": "yellow",
    "budget": 60000,
    "created_at": "2024-02-15T10:00:00Z"
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Apply pagination
    const paginatedProjects = MOCK_PROJECTS.slice(offset, offset + limit)
    
    return NextResponse.json({
      projects: paginatedProjects,
      total: MOCK_PROJECTS.length,
      limit,
      offset
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Projects API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}