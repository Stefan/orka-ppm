#!/usr/bin/env node
/**
 * Automated Dark Mode Fixer
 *
 * Scans all .tsx files in app/ and components/ and adds missing dark: variants
 * to Tailwind CSS class strings.
 *
 * Usage: node scripts/fix-dark-mode.mjs [--dry-run]
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.resolve(__dirname, '..')

// ── Rules ───────────────────────────────────────────────────────────────────

const RULES = [
  // ── Backgrounds (negative lookbehind to avoid matching inside hover:/focus: prefixed classes) ──
  { find: /(?<!hover:|focus:)\bbg-white\b/g, replace: 'bg-white dark:bg-slate-800', skipIf: 'dark:bg-' },
  { find: /(?<!hover:|focus:)\bbg-gray-50\b/g, replace: 'bg-gray-50 dark:bg-slate-800/50', skipIf: 'dark:bg-' },
  { find: /(?<!hover:|focus:)\bbg-gray-100\b/g, replace: 'bg-gray-100 dark:bg-slate-700', skipIf: 'dark:bg-' },

  // ── Text – gray scale ──
  { find: /\btext-gray-900\b/g, replace: 'text-gray-900 dark:text-slate-100', skipIf: 'dark:text-' },
  { find: /\btext-gray-800\b/g, replace: 'text-gray-800 dark:text-slate-200', skipIf: 'dark:text-' },
  { find: /\btext-gray-700\b/g, replace: 'text-gray-700 dark:text-slate-300', skipIf: 'dark:text-' },
  { find: /\btext-gray-600\b/g, replace: 'text-gray-600 dark:text-slate-400', skipIf: 'dark:text-' },
  { find: /\btext-gray-500\b/g, replace: 'text-gray-500 dark:text-slate-400', skipIf: 'dark:text-' },
  { find: /\btext-gray-400\b/g, replace: 'text-gray-400 dark:text-slate-500', skipIf: 'dark:text-' },

  // ── Borders ──
  { find: /\bborder-gray-200\b/g, replace: 'border-gray-200 dark:border-slate-700', skipIf: 'dark:border-' },
  { find: /\bborder-gray-300\b/g, replace: 'border-gray-300 dark:border-slate-600', skipIf: 'dark:border-' },
  { find: /\bborder-gray-100\b/g, replace: 'border-gray-100 dark:border-slate-700', skipIf: 'dark:border-' },

  // ── Semantic coloured text (600-level) ──
  { find: /\btext-blue-600\b/g, replace: 'text-blue-600 dark:text-blue-400', skipIf: 'dark:text-' },
  { find: /\btext-green-600\b/g, replace: 'text-green-600 dark:text-green-400', skipIf: 'dark:text-' },
  { find: /\btext-red-600\b/g, replace: 'text-red-600 dark:text-red-400', skipIf: 'dark:text-' },
  { find: /\btext-purple-600\b/g, replace: 'text-purple-600 dark:text-purple-400', skipIf: 'dark:text-' },
  { find: /\btext-orange-600\b/g, replace: 'text-orange-600 dark:text-orange-400', skipIf: 'dark:text-' },
  { find: /\btext-indigo-600\b/g, replace: 'text-indigo-600 dark:text-indigo-400', skipIf: 'dark:text-' },
  { find: /\btext-teal-600\b/g, replace: 'text-teal-600 dark:text-teal-400', skipIf: 'dark:text-' },
  { find: /\btext-amber-600\b/g, replace: 'text-amber-600 dark:text-amber-400', skipIf: 'dark:text-' },
  { find: /\btext-yellow-600\b/g, replace: 'text-yellow-600 dark:text-yellow-400', skipIf: 'dark:text-' },
  { find: /\btext-cyan-600\b/g, replace: 'text-cyan-600 dark:text-cyan-400', skipIf: 'dark:text-' },
  { find: /\btext-emerald-600\b/g, replace: 'text-emerald-600 dark:text-emerald-400', skipIf: 'dark:text-' },

  // ── Semantic coloured text (800-level) ──
  { find: /\btext-red-800\b/g, replace: 'text-red-800 dark:text-red-300', skipIf: 'dark:text-' },
  { find: /\btext-green-800\b/g, replace: 'text-green-800 dark:text-green-300', skipIf: 'dark:text-' },
  { find: /\btext-yellow-800\b/g, replace: 'text-yellow-800 dark:text-yellow-300', skipIf: 'dark:text-' },
  { find: /\btext-blue-800\b/g, replace: 'text-blue-800 dark:text-blue-300', skipIf: 'dark:text-' },
  { find: /\btext-orange-800\b/g, replace: 'text-orange-800 dark:text-orange-300', skipIf: 'dark:text-' },
  { find: /\btext-purple-800\b/g, replace: 'text-purple-800 dark:text-purple-300', skipIf: 'dark:text-' },

  // ── Coloured backgrounds (100-level, used for badges/alerts) ──
  // Negative lookbehind prevents matching inside hover:/focus: prefixed classes
  { find: /(?<!hover:|focus:)\bbg-red-100\b/g, replace: 'bg-red-100 dark:bg-red-900/30', skipIf: 'dark:bg-' },
  { find: /(?<!hover:|focus:)\bbg-green-100\b/g, replace: 'bg-green-100 dark:bg-green-900/30', skipIf: 'dark:bg-' },
  { find: /(?<!hover:|focus:)\bbg-yellow-100\b/g, replace: 'bg-yellow-100 dark:bg-yellow-900/30', skipIf: 'dark:bg-' },
  { find: /(?<!hover:|focus:)\bbg-blue-100\b/g, replace: 'bg-blue-100 dark:bg-blue-900/30', skipIf: 'dark:bg-' },
  { find: /(?<!hover:|focus:)\bbg-orange-100\b/g, replace: 'bg-orange-100 dark:bg-orange-900/30', skipIf: 'dark:bg-' },
  { find: /(?<!hover:|focus:)\bbg-purple-100\b/g, replace: 'bg-purple-100 dark:bg-purple-900/30', skipIf: 'dark:bg-' },
  { find: /(?<!hover:|focus:)\bbg-indigo-100\b/g, replace: 'bg-indigo-100 dark:bg-indigo-900/30', skipIf: 'dark:bg-' },

  // ── Hover backgrounds ──
  { find: /\bhover:bg-gray-50\b/g, replace: 'hover:bg-gray-50 dark:hover:bg-slate-700', skipIf: 'dark:hover:bg-' },
  { find: /\bhover:bg-gray-100\b/g, replace: 'hover:bg-gray-100 dark:hover:bg-slate-600', skipIf: 'dark:hover:bg-' },
  { find: /\bhover:bg-gray-200\b/g, replace: 'hover:bg-gray-200 dark:hover:bg-slate-600', skipIf: 'dark:hover:bg-' },

  // ── Hover text ──
  { find: /\bhover:text-gray-900\b/g, replace: 'hover:text-gray-900 dark:hover:text-slate-100', skipIf: 'dark:hover:text-' },
  { find: /\bhover:text-gray-700\b/g, replace: 'hover:text-gray-700 dark:hover:text-slate-300', skipIf: 'dark:hover:text-' },
  { find: /\bhover:text-blue-800\b/g, replace: 'hover:text-blue-800 dark:hover:text-blue-300', skipIf: 'dark:hover:text-' },
  { find: /\bhover:text-red-800\b/g, replace: 'hover:text-red-800 dark:hover:text-red-300', skipIf: 'dark:hover:text-' },
  { find: /\bhover:text-green-800\b/g, replace: 'hover:text-green-800 dark:hover:text-green-300', skipIf: 'dark:hover:text-' },

  // ── Divider / ring ──
  { find: /\bdivide-gray-200\b/g, replace: 'divide-gray-200 dark:divide-slate-700', skipIf: 'dark:divide-' },
  { find: /\bring-gray-300\b/g, replace: 'ring-gray-300 dark:ring-slate-600', skipIf: 'dark:ring-' },

  // ── Coloured borders ──
  { find: /\bborder-red-200\b/g, replace: 'border-red-200 dark:border-red-800', skipIf: 'dark:border-' },
  { find: /\bborder-green-200\b/g, replace: 'border-green-200 dark:border-green-800', skipIf: 'dark:border-' },
  { find: /\bborder-yellow-200\b/g, replace: 'border-yellow-200 dark:border-yellow-800', skipIf: 'dark:border-' },
  { find: /\bborder-blue-200\b/g, replace: 'border-blue-200 dark:border-blue-800', skipIf: 'dark:border-' },
]

// ── file collection ─────────────────────────────────────────────────────────

function collectTSXFiles(dir) {
  const results = []
  const skipDirs = new Set(['node_modules', '.next', 'dist', 'coverage', '.git', '__tests__'])

  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(path.join(d, entry.name))
      } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
        results.push(path.join(d, entry.name))
      }
    }
  }

  walk(dir)
  return results
}

// ── processing ──────────────────────────────────────────────────────────────

function processLine(line) {
  const changes = []
  let modified = line

  // Skip comment lines, imports, types
  const trimmed = line.trimStart()
  if (trimmed.startsWith('//') || trimmed.startsWith('*') ||
      trimmed.startsWith('import ') || trimmed.startsWith('type ') ||
      trimmed.startsWith('interface ')) {
    return { modified, changes }
  }

  for (const rule of RULES) {
    // Skip if line already has the dark variant for this rule
    if (modified.includes(rule.skipIf)) continue

    rule.find.lastIndex = 0
    const before = modified
    modified = modified.replace(rule.find, rule.replace)
    if (modified !== before) {
      changes.push(rule.replace)
    }
  }

  return { modified, changes }
}

function processFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const lines = source.split('\n')
  let totalChanges = 0
  const newLines = []

  for (const line of lines) {
    const { modified, changes } = processLine(line)
    newLines.push(modified)
    totalChanges += changes.length
  }

  const newSource = newLines.join('\n')
  const changed = newSource !== source

  if (changed && !DRY_RUN) {
    fs.writeFileSync(filePath, newSource, 'utf8')
  }

  return { changed, changeCount: totalChanges }
}

// ── main ────────────────────────────────────────────────────────────────────

const appDir = path.join(ROOT, 'app')
const componentsDir = path.join(ROOT, 'components')

const files = [
  ...collectTSXFiles(appDir),
  ...collectTSXFiles(componentsDir),
]

console.log(`\nScanning ${files.length} .tsx files...`)
if (DRY_RUN) console.log('   (dry run - no files will be modified)\n')
else console.log('')

let totalFiles = 0
let totalChanges = 0

for (const file of files) {
  const { changed, changeCount } = processFile(file)
  if (changed) {
    totalFiles++
    totalChanges += changeCount
    const relPath = path.relative(ROOT, file)
    console.log(`  ${relPath} (${changeCount} fixes)`)
  }
}

console.log(`\n========================================`)
console.log(`  Files modified: ${totalFiles}`)
console.log(`  Total fixes:    ${totalChanges}`)
console.log(`========================================\n`)
