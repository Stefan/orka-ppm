#!/usr/bin/env tsx
/**
 * Generate locale JSON files from en.json using the xAI API (Grok).
 *
 * Usage:
 *   XAI_API_KEY=your_key npx tsx scripts/generate-locale-files-with-grok.ts
 *   npm run generate-locales   (reads key from .env or backend/.env)
 *
 * Key is read from (in order): XAI_API_KEY, then OPENAI_API_KEY (e.g. in backend/.env with OPENAI_BASE_URL=https://api.x.ai/v1).
 *
 * Optional: GENERATE_LOCALES=es-MX,zh-CN to only generate specific locales (default: all 6 new ones).
 *
 * Preserves interpolation placeholders like {count}, {date}, {error}.
 * Writes to public/locales/{locale}.json. Backs up existing file if present.
 *
 * API: https://api.x.ai (OpenAI-compatible chat completions)
 */

import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

const ROOT = process.cwd()
config({ path: path.join(ROOT, '.env'), quiet: true })
config({ path: path.join(ROOT, '.env.local'), quiet: true })
config({ path: path.join(ROOT, 'backend', '.env'), quiet: true })

const LOCALES_DIR = path.join(ROOT, 'public', 'locales')
const EN_PATH = path.join(LOCALES_DIR, 'en.json')

const XAI_API_URL =
  process.env.XAI_API_URL ??
  (process.env.OPENAI_BASE_URL
    ? `${process.env.OPENAI_BASE_URL.replace(/\/?$/, '')}/chat/completions`
    : 'https://api.x.ai/v1/chat/completions')
const API_KEY = process.env.XAI_API_KEY ?? process.env.OPENAI_API_KEY
const XAI_MODEL = process.env.XAI_MODEL ?? process.env.OPENAI_MODEL ?? 'grok-beta'

const TARGET_LOCALES = (process.env.GENERATE_LOCALES ?? 'es-MX,zh-CN,hi-IN,ja-JP,ko-KR,vi-VN').split(',').map((s) => s.trim())

const LOCALE_NAMES: Record<string, string> = {
  'es-MX': 'Spanish (Mexico)',
  'zh-CN': 'Simplified Chinese (China)',
  'hi-IN': 'Hindi (India)',
  'ja-JP': 'Japanese (Japan)',
  'ko-KR': 'Korean (Korea)',
  'vi-VN': 'Vietnamese (Vietnam)',
}

type NestedRecord = Record<string, string | NestedRecord>

function isPlainObject (v: unknown): v is NestedRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function* walkStrings (obj: NestedRecord, prefix = ''): Generator<[string, string]> {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') yield [p, v]
    else if (isPlainObject(v)) yield* walkStrings(v, p)
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

const BATCH_SIZE = 45

async function translateBatch (
  entries: [string, string][],
  targetLocale: string,
  targetLanguageName: string
): Promise<Record<string, string>> {
  const obj: Record<string, string> = {}
  for (const [k, v] of entries) obj[k] = v
  const jsonStr = JSON.stringify(obj, null, 0)

  const systemPrompt = `You are a professional localizer. Translate ONLY the string values of the given JSON from English to ${targetLanguageName}. Rules:
- Return valid JSON with the exact same keys; only change the string values.
- Preserve placeholders exactly as written: {count}, {date}, {error}, {seconds}, {row}, {total}, {shown}, {projectName}, etc. Do not translate or move them.
- Keep UI tone: short labels, button text, tooltips. Use formal "you" where the app uses formal tone.
- For PPM/ERP terms: "Variance" = budget/actual difference; "EAC" = Estimate at Completion; "BAC" = Budget at Completion; "Commitments" = orders/commitments; "Actuals" = actual costs. Use standard terms in the target language.`

  const userPrompt = `Translate this JSON to ${targetLanguageName}. Return only the JSON object, no markdown or explanation.\n\n${jsonStr}`

  const res = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`xAI API ${res.status}: ${err}`)
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('Empty response from xAI API')

  let parsed: Record<string, string>
  const cleaned = content.replace(/^```json?\s*|\s*```$/g, '').trim()
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`xAI API returned invalid JSON: ${content.slice(0, 200)}...`)
  }
  return parsed
}

function sleep (ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main () {
  if (!API_KEY) {
    console.error(
  'Set XAI_API_KEY (or OPENAI_API_KEY in .env/backend/.env with OPENAI_BASE_URL=https://api.x.ai/v1) to run this script. Get key: https://console.x.ai'
)
    process.exit(1)
  }

  if (!fs.existsSync(EN_PATH)) {
    console.error('Missing public/locales/en.json')
    process.exit(1)
  }

  const enRaw = fs.readFileSync(EN_PATH, 'utf-8')
  const en = JSON.parse(enRaw) as NestedRecord
  const entries = Array.from(walkStrings(en))
  console.log(`Loaded en.json: ${entries.length} string entries. Target locales: ${TARGET_LOCALES.join(', ')}`)

  for (const locale of TARGET_LOCALES) {
    const name = LOCALE_NAMES[locale] ?? locale
    const outPath = path.join(LOCALES_DIR, `${locale}.json`)
    if (fs.existsSync(outPath)) {
      const backup = `${outPath}.bak.${Date.now()}`
      fs.copyFileSync(outPath, backup)
      console.log(`Backed up ${locale} to ${path.basename(backup)}`)
    }

    const result: NestedRecord = {}
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE)
      process.stdout.write(`  ${locale}: batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)} ... `)
      try {
        const translated = await translateBatch(batch, locale, name)
        for (const [key, value] of Object.entries(translated)) {
          setByPath(result, key, value)
        }
        console.log('ok')
        await sleep(600)
      } catch (e) {
        console.log('fail')
        console.error(e)
        process.exit(1)
      }
    }

    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf-8')
    console.log(`Wrote ${outPath}`)
  }

  console.log('Done.')
}

main()
