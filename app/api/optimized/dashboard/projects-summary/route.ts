import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://orka-ppm.onrender.com' : 'http://localhost:8001')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    const limit = searchParams.get('limit') || '10'
    const offset = searchParams.get('offset') || '0'
    
    // Forward request to backend
    const response = await fetch(`${BACKEND_URL}/projects?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
    })
    
    if (!response.ok) {
      console.error('Backend projects summary API error:', response.status)
      // Return fallback mock data if backend is unavailable
      return NextResponse.json(getMockProjects(parseInt(limit), parseInt(offset)), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Data-Source': 'fallback-mock'
        },
      })
    }
    
    const data = await response.json()
    
    // Handle both array and object responses
    const projects = Array.isArray(data) ? data : data?.projects || []
    
    return NextResponse.json(projects, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=60', // Cache for 30 seconds
        'X-Data-Source': 'backend-real'
      },
    })
  } catch (error) {
    console.error('Projects summary API error:', error)
    // Return fallback mock data on error
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    return NextResponse.json(getMockProjects(limit, offset), {
      status: 200,
      headers: {
        'X-Data-Source': 'fallback-mock'
      }
    })
  }
}

function getMockProjects(limit: number, offset: number) {
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
  
  return MOCK_PROJECTS.slice(offset, offset + limit)
}