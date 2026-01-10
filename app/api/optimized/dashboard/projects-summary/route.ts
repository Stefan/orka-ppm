import { NextRequest, NextResponse } from 'next/server'

// Mock project data for dashboard
const MOCK_PROJECTS = [
  {
    "id": "1",
    "name": "Office Complex Phase 1",
    "status": "active",
    "health": "green",
    "budget": 150000,
    "actual": 145000,
    "variance": -5000,
    "variance_percentage": -3.3,
    "created_at": "2024-01-15T10:00:00Z"
  },
  {
    "id": "2",
    "name": "Residential Tower A",
    "status": "active",
    "health": "yellow",
    "budget": 200000,
    "actual": 210000,
    "variance": 10000,
    "variance_percentage": 5.0,
    "created_at": "2024-01-20T10:00:00Z"
  },
  {
    "id": "3",
    "name": "Shopping Center Renovation",
    "status": "active",
    "health": "red",
    "budget": 80000,
    "actual": 95000,
    "variance": 15000,
    "variance_percentage": 18.8,
    "created_at": "2024-02-01T10:00:00Z"
  },
  {
    "id": "4",
    "name": "Parking Garage Construction",
    "status": "active",
    "health": "green",
    "budget": 120000,
    "actual": 115000,
    "variance": -5000,
    "variance_percentage": -4.2,
    "created_at": "2024-02-10T10:00:00Z"
  },
  {
    "id": "5",
    "name": "Landscape Development",
    "status": "active",
    "health": "yellow",
    "budget": 60000,
    "actual": 62000,
    "variance": 2000,
    "variance_percentage": 3.3,
    "created_at": "2024-02-15T10:00:00Z"
  },
  {
    "id": "6",
    "name": "Security System Installation",
    "status": "completed",
    "health": "green",
    "budget": 45000,
    "actual": 43000,
    "variance": -2000,
    "variance_percentage": -4.4,
    "created_at": "2024-01-05T10:00:00Z"
  },
  {
    "id": "7",
    "name": "HVAC System Upgrade",
    "status": "active",
    "health": "green",
    "budget": 90000,
    "actual": 87000,
    "variance": -3000,
    "variance_percentage": -3.3,
    "created_at": "2024-02-20T10:00:00Z"
  },
  {
    "id": "8",
    "name": "Elevator Modernization",
    "status": "planning",
    "health": "green",
    "budget": 110000,
    "actual": 0,
    "variance": 0,
    "variance_percentage": 0,
    "created_at": "2024-03-01T10:00:00Z"
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Apply pagination
    const paginatedProjects = MOCK_PROJECTS.slice(offset, offset + limit)
    
    return NextResponse.json(paginatedProjects, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Projects summary API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects summary' },
      { status: 500 }
    )
  }
}