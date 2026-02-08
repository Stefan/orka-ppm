import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    // #region agent log
    const _backendUrl = BACKEND_URL;
    // #endregion
    const response = await fetch(`${BACKEND_URL}/api/admin/performance/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/performance/stats/route.ts:proxy',message:'backend not ok',data:{backendUrl:_backendUrl,status:response.status,bodyPreview:errorText.slice(0,200)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      return NextResponse.json({ error: errorText }, { status: response.status })
    }

    const data = await response.json()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/performance/stats/route.ts:proxy',message:'backend ok',data:{backendUrl:_backendUrl,total_requests:data?.total_requests,endpointCount:data?.endpoint_stats?Object.keys(data.endpoint_stats).length:0},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying performance stats:', error)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/performance/stats/route.ts:catch',message:'proxy fetch threw',data:{err:error instanceof Error?error.message:String(error),backendUrl:process.env.BACKEND_URL||process.env.NEXT_PUBLIC_BACKEND_URL||'http://localhost:8000'},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: 'Failed to get performance stats' }, { status: 500 })
  }
}
