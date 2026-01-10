/**
 * Help Chat Translation API Endpoint
 * Provides translation services for help content
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock translation service
const MOCK_TRANSLATIONS: Record<string, Record<string, string>> = {
  'es': {
    'Dashboard Optimization': 'Optimización del Panel',
    'Consider using the AI-enhanced dashboard view for better insights into your project performance.': 'Considera usar la vista del panel mejorada con IA para obtener mejores perspectivas del rendimiento de tu proyecto.',
    'Cross-Device Sync': 'Sincronización entre Dispositivos',
    'Your dashboard preferences are now synced across all your devices.': 'Las preferencias de tu panel ahora están sincronizadas en todos tus dispositivos.',
    'Performance Insights': 'Perspectivas de Rendimiento',
    'Your projects are performing well!': '¡Tus proyectos están funcionando bien!'
  },
  'fr': {
    'Dashboard Optimization': 'Optimisation du Tableau de Bord',
    'Consider using the AI-enhanced dashboard view for better insights into your project performance.': 'Considérez utiliser la vue du tableau de bord améliorée par IA pour de meilleures perspectives sur les performances de votre projet.',
    'Cross-Device Sync': 'Synchronisation Multi-Appareils',
    'Your dashboard preferences are now synced across all your devices.': 'Vos préférences de tableau de bord sont maintenant synchronisées sur tous vos appareils.',
    'Performance Insights': 'Aperçus de Performance',
    'Your projects are performing well!': 'Vos projets fonctionnent bien!'
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, targetLanguage } = body
    
    if (!content || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields: content and targetLanguage' },
        { status: 400 }
      )
    }
    
    // Mock translation
    const translations = MOCK_TRANSLATIONS[targetLanguage]
    const translatedText = translations?.[content] || content
    
    return NextResponse.json({
      translatedText,
      sourceLanguage: 'en',
      targetLanguage,
      confidence: translations?.[content] ? 0.95 : 0.1,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Help chat translation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to translate content',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}