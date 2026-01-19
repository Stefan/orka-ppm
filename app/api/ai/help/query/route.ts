import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const USE_MOCK = process.env.HELP_CHAT_USE_MOCK === 'true' // Backend fix applied

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[Help Chat Proxy] Received request body:', JSON.stringify(body, null, 2))
    
    // TEMPORARY: Return mock response until backend issue is resolved
    if (USE_MOCK) {
      console.log('[Help Chat Proxy] Using mock response (backend has validation issue)')
      
      const mockResponse = {
        response: `Ich verstehe deine Frage: "${body.query}"\n\nDiese App ist ein umfassendes PPM (Project Portfolio Management) System mit folgenden Hauptfunktionen:\n\n1. **Dashboard & Übersicht**: Visualisierung von Projektportfolios, KPIs und Gesundheitsindikatoren\n2. **Projektmanagement**: Erstellung, Verwaltung und Tracking von Projekten\n3. **Ressourcenplanung**: Optimierung der Ressourcenzuweisung\n4. **Finanzmanagement**: Budget-Tracking und Kostenanalyse\n5. **Risikomanagement**: Identifikation und Bewertung von Projektrisiken\n6. **Berichtswesen**: Generierung von Berichten und Analysen\n7. **Monte-Carlo-Simulationen**: Risikoanalyse und Prognosen\n8. **AI-gestützte Features**: Intelligente Empfehlungen und Optimierungen\n\nWie kann ich dir bei einem spezifischen Feature helfen?`,
        sessionId: body.sessionId || `mock-${Date.now()}`,
        sources: [
          {
            title: "PPM Dashboard Documentation",
            url: "/docs/dashboard",
            relevance: 0.9
          },
          {
            title: "Feature Overview",
            url: "/docs/features",
            relevance: 0.85
          }
        ],
        confidence: 0.8,
        responseTimeMs: 50,
        proactiveTips: [],
        suggestedActions: [
          {
            id: "action-create-project",
            label: "Projekt erstellen",
            action: () => console.log("Navigate to create project"),
            icon: "plus"
          },
          {
            id: "action-view-dashboard",
            label: "Dashboard ansehen",
            action: () => console.log("Navigate to dashboard"),
            icon: "dashboard"
          }
        ],
        relatedGuides: [],
        isCached: false,
        isFallback: true
      }
      
      return NextResponse.json(mockResponse)
    }
    
    // Original backend code (currently not working due to FastAPI validation issue)
    const backendBody = {
      query: body.query,
      session_id: body.sessionId || null,
      context: body.context,
      language: body.language || 'en',
      include_proactive_tips: body.includeProactiveTips !== undefined ? body.includeProactiveTips : false
    }
    
    console.log('[Help Chat Proxy] Sending to backend:', JSON.stringify(backendBody, null, 2))
    
    const authHeader = request.headers.get('authorization')
    const backendUrl = `${BACKEND_URL}/ai/help/query`
    
    let response: Response
    
    try {
      response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(authHeader ? { 'Authorization': authHeader } : {})
        },
        body: JSON.stringify(backendBody)
      })
    } catch (fetchError) {
      console.error('[Help Chat Proxy] Failed to connect to backend:', fetchError)
      
      return NextResponse.json({
        response: "Das Help-System ist momentan nicht verfügbar. Bitte versuche es später erneut.",
        sessionId: body.sessionId || `fallback-${Date.now()}`,
        sources: [],
        confidence: 0,
        responseTimeMs: 0,
        proactiveTips: [],
        suggestedActions: [],
        relatedGuides: [],
        isCached: false,
        isFallback: true
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Help Chat Proxy] Backend error:', response.status, errorText)
      
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    const frontendData = {
      response: data.response,
      sessionId: data.session_id || data.sessionId,
      sources: data.sources || [],
      confidence: data.confidence || 0,
      responseTimeMs: data.response_time_ms || data.responseTimeMs || 0,
      proactiveTips: data.proactive_tips || data.proactiveTips || [],
      suggestedActions: data.suggested_actions || data.suggestedActions || [],
      relatedGuides: data.related_guides || data.relatedGuides || [],
      isCached: data.is_cached || data.isCached || false,
      isFallback: data.is_fallback || data.isFallback || false
    }
    
    return NextResponse.json(frontendData)
  } catch (error) {
    console.error('[Help Chat Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process help query', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
