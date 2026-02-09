/**
 * Translate API – batch translate locale JSON (e.g. en → es-MX) via DeepL.
 * Used for initial locale file generation; optional RAG/terminology check.
 * 
 * POST body: { sourceLocale, targetLocale, payload }
 * payload: nested object with string values (keys preserved).
 * Response: { translated, sourceLocale, targetLocale, suggestions?: }
 */

import { NextRequest, NextResponse } from 'next/server'

const DEEPL_API_KEY = process.env.DEEPL_API_KEY
const DEEPL_API_URL = process.env.DEEPL_API_URL ?? 'https://api-free.deepl.com/v2/translate'

interface NestedRecord {
  [key: string]: string | NestedRecord;
}

function isPlainObject (v: unknown): v is NestedRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function* walkStrings (obj: NestedRecord, prefix = ''): Generator<[string, string]> {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') yield [path, v]
    else if (isPlainObject(v)) yield* walkStrings(v, path)
  }
}

function setByPath (out: NestedRecord, path: string, value: string) {
  const parts = path.split('.')
  let cur: NestedRecord = out
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!isPlainObject(cur[p])) cur[p] = {}
    cur = cur[p] as NestedRecord
  }
  cur[parts[parts.length - 1]] = value
}

async function translateWithDeepL (text: string, targetLang: string, sourceLang: string): Promise<string> {
  if (!DEEPL_API_KEY) return text
  const form = new URLSearchParams()
  form.set('text', text)
  form.set('target_lang', targetLang.toUpperCase().replace(/-.*/, ''))
  if (sourceLang && sourceLang !== 'en') form.set('source_lang', sourceLang.toUpperCase().replace(/-.*/, ''))
  const res = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepL error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.translations?.[0]?.text ?? text
}

/** Map our locale codes to DeepL target_lang (e.g. zh-CN → ZH, es-MX → ES). */
function toDeepLLang (locale: string): string {
  const map: Record<string, string> = {
    'en': 'EN', 'de': 'DE', 'fr': 'FR', 'es': 'ES', 'pl': 'PL',
    'es-MX': 'ES', 'zh-CN': 'ZH', 'hi-IN': 'HI', 'ja-JP': 'JA', 'ko-KR': 'KO', 'vi-VN': 'VI',
  }
  return map[locale] ?? locale.split('-')[0].toUpperCase()
}

/** Optional: terminology suggestions for domain terms (e.g. Variance → Varianza). Placeholder for RAG. */
function getTermSuggestions (targetLocale: string, _key: string, _value: string): string[] {
  // Could call backend RAG / help_documentation_rag for consistent terms
  return []
}

export async function POST (request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceLocale = 'en', targetLocale, payload } = body as {
      sourceLocale?: string
      targetLocale?: string
      payload?: NestedRecord
    }

    if (!targetLocale || !isPlainObject(payload)) {
      return NextResponse.json(
        { error: 'Missing or invalid: targetLocale and payload (object) required' },
        { status: 400 }
      )
    }

    const translated: NestedRecord = {}
    const suggestions: Array<{ key: string; value: string; suggestions: string[] }> = []

    for (const [path, value] of walkStrings(payload)) {
      let result = value
      if (DEEPL_API_KEY) {
        try {
          result = await translateWithDeepL(value, toDeepLLang(targetLocale), sourceLocale)
        } catch (e) {
          console.warn(`Translate failed for ${path}:`, e)
        }
      }
      setByPath(translated, path, result)
      const sug = getTermSuggestions(targetLocale, path, result)
      if (sug.length) suggestions.push({ key: path, value: result, suggestions: sug })
    }

    return NextResponse.json({
      translated,
      sourceLocale,
      targetLocale,
      ...(suggestions.length ? { suggestions } : {}),
    })
  } catch (error) {
    console.error('Translate API error:', error)
    return NextResponse.json(
      { error: 'Translation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
