/**
 * Help Chat Language Detection API Endpoint
 * Detects the language of user input
 */

import { NextRequest, NextResponse } from 'next/server'

// Simple language detection patterns
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  'es': [
    /\b(el|la|los|las|un|una|de|en|con|por|para|que|es|son|está|están)\b/gi,
    /\b(hola|gracias|por favor|sí|no|bueno|muy|más|menos|todo|nada)\b/gi
  ],
  'fr': [
    /\b(le|la|les|un|une|de|du|des|en|avec|pour|que|est|sont|être|avoir)\b/gi,
    /\b(bonjour|merci|s'il vous plaît|oui|non|bien|très|plus|moins|tout|rien)\b/gi
  ],
  'de': [
    /\b(der|die|das|ein|eine|und|oder|mit|für|von|zu|ist|sind|haben|sein)\b/gi,
    /\b(hallo|danke|bitte|ja|nein|gut|sehr|mehr|weniger|alles|nichts)\b/gi
  ],
  'it': [
    /\b(il|la|lo|gli|le|un|una|di|in|con|per|che|è|sono|essere|avere)\b/gi,
    /\b(ciao|grazie|prego|sì|no|bene|molto|più|meno|tutto|niente)\b/gi
  ]
}

function detectLanguage(content: string): { language: string; confidence: number } {
  const text = content.toLowerCase()
  
  // Check for English patterns (default)
  const englishPatterns = [
    /\b(the|and|or|with|for|from|to|is|are|have|has|will|would|could|should)\b/gi,
    /\b(hello|thanks|please|yes|no|good|very|more|less|all|nothing)\b/gi
  ]
  
  let bestMatch = { language: 'en', confidence: 0 }
  
  // Check English first
  let englishMatches = 0
  englishPatterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) englishMatches += matches.length
  })
  
  if (englishMatches > 0) {
    bestMatch = { language: 'en', confidence: Math.min(englishMatches / 10, 0.95) }
  }
  
  // Check other languages
  Object.entries(LANGUAGE_PATTERNS).forEach(([lang, patterns]) => {
    let matches = 0
    patterns.forEach(pattern => {
      const langMatches = text.match(pattern)
      if (langMatches) matches += langMatches.length
    })
    
    const confidence = Math.min(matches / 8, 0.95)
    if (confidence > bestMatch.confidence) {
      bestMatch = { language: lang, confidence }
    }
  })
  
  // If no strong matches, default to English with low confidence
  if (bestMatch.confidence < 0.3) {
    bestMatch = { language: 'en', confidence: 0.5 }
  }
  
  return bestMatch
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content } = body
    
    if (!content) {
      return NextResponse.json(
        { error: 'Missing required field: content' },
        { status: 400 }
      )
    }
    
    const detection = detectLanguage(content)
    
    return NextResponse.json({
      ...detection,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it'],
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Help chat language detection error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to detect language',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}