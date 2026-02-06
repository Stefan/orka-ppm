#!/usr/bin/env ts-node
/**
 * Automated Dark Mode Fixer
 *
 * Scans all .tsx files in app/ and components/ and adds missing dark: variants
 * to Tailwind CSS class strings.
 *
 * Usage: npx ts-node scripts/fix-dark-mode.ts [--dry-run]
 */

import * as fs from 'fs'
import * as path from 'path'

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.resolve(__dirname, '..')

// ── replacements ────────────────────────────────────────────────────────────
// Each rule: [regex to match, replacement]
// The regex MUST use word boundaries and NOT match strings that already have dark: variants

interface FixRule {
  /** What to find — must not already have the dark variant */
  find: RegExp
  /** What to replace it with */
  replace: string
  /** Skip if the className string already contains this */
  skipIf: string
}

const RULES: FixRule[] = [
  // ── Backgrounds ──
  { find: /\bbg-white\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-white dark:bg-slate-800', skipIf: 'dark:bg-' },
  { find: /\bbg-gray-50\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-gray-50 dark:bg-slate-800/50', skipIf: 'dark:bg-' },
  { find: /\bbg-gray-100\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-gray-100 dark:bg-slate-700', skipIf: 'dark:bg-' },

  // ── Text – gray scale ──
  { find: /\btext-gray-900\b(?![\s"'`]*dark:text-)/g, replace: 'text-gray-900 dark:text-slate-100', skipIf: 'dark:text-' },
  { find: /\btext-gray-800\b(?![\s"'`]*dark:text-)/g, replace: 'text-gray-800 dark:text-slate-200', skipIf: 'dark:text-' },
  { find: /\btext-gray-700\b(?![\s"'`]*dark:text-)/g, replace: 'text-gray-700 dark:text-slate-300', skipIf: 'dark:text-' },
  { find: /\btext-gray-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-gray-600 dark:text-slate-400', skipIf: 'dark:text-' },
  { find: /\btext-gray-500\b(?![\s"'`]*dark:text-)/g, replace: 'text-gray-500 dark:text-slate-400', skipIf: 'dark:text-' },
  { find: /\btext-gray-400\b(?![\s"'`]*dark:text-)/g, replace: 'text-gray-400 dark:text-slate-500', skipIf: 'dark:text-' },

  // ── Borders ──
  { find: /\bborder-gray-200\b(?![\s"'`]*dark:border-)/g, replace: 'border-gray-200 dark:border-slate-700', skipIf: 'dark:border-' },
  { find: /\bborder-gray-300\b(?![\s"'`]*dark:border-)/g, replace: 'border-gray-300 dark:border-slate-600', skipIf: 'dark:border-' },
  { find: /\bborder-gray-100\b(?![\s"'`]*dark:border-)/g, replace: 'border-gray-100 dark:border-slate-700', skipIf: 'dark:border-' },

  // ── Semantic coloured text (600-level) ──
  { find: /\btext-blue-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-blue-600 dark:text-blue-400', skipIf: 'dark:text-' },
  { find: /\btext-green-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-green-600 dark:text-green-400', skipIf: 'dark:text-' },
  { find: /\btext-red-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-red-600 dark:text-red-400', skipIf: 'dark:text-' },
  { find: /\btext-purple-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-purple-600 dark:text-purple-400', skipIf: 'dark:text-' },
  { find: /\btext-orange-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-orange-600 dark:text-orange-400', skipIf: 'dark:text-' },
  { find: /\btext-indigo-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-indigo-600 dark:text-indigo-400', skipIf: 'dark:text-' },
  { find: /\btext-teal-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-teal-600 dark:text-teal-400', skipIf: 'dark:text-' },
  { find: /\btext-amber-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-amber-600 dark:text-amber-400', skipIf: 'dark:text-' },
  { find: /\btext-yellow-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-yellow-600 dark:text-yellow-400', skipIf: 'dark:text-' },
  { find: /\btext-cyan-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-cyan-600 dark:text-cyan-400', skipIf: 'dark:text-' },
  { find: /\btext-emerald-600\b(?![\s"'`]*dark:text-)/g, replace: 'text-emerald-600 dark:text-emerald-400', skipIf: 'dark:text-' },

  // ── Semantic coloured text (800-level, used on coloured backgrounds) ──
  { find: /\btext-red-800\b(?![\s"'`]*dark:text-)/g, replace: 'text-red-800 dark:text-red-300', skipIf: 'dark:text-' },
  { find: /\btext-green-800\b(?![\s"'`]*dark:text-)/g, replace: 'text-green-800 dark:text-green-300', skipIf: 'dark:text-' },
  { find: /\btext-yellow-800\b(?![\s"'`]*dark:text-)/g, replace: 'text-yellow-800 dark:text-yellow-300', skipIf: 'dark:text-' },
  { find: /\btext-blue-800\b(?![\s"'`]*dark:text-)/g, replace: 'text-blue-800 dark:text-blue-300', skipIf: 'dark:text-' },
  { find: /\btext-orange-800\b(?![\s"'`]*dark:text-)/g, replace: 'text-orange-800 dark:text-orange-300', skipIf: 'dark:text-' },
  { find: /\btext-purple-800\b(?![\s"'`]*dark:text-)/g, replace: 'text-purple-800 dark:text-purple-300', skipIf: 'dark:text-' },

  // ── Coloured backgrounds (100-level, used for badges/alerts) ──
  { find: /\bbg-red-100\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-red-100 dark:bg-red-900/30', skipIf: 'dark:bg-' },
  { find: /\bbg-green-100\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-green-100 dark:bg-green-900/30', skipIf: 'dark:bg-' },
  { find: /\bbg-yellow-100\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-yellow-100 dark:bg-yellow-900/30', skipIf: 'dark:bg-' },
  { find: /\bbg-blue-100\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-blue-100 dark:bg-blue-900/30', skipIf: 'dark:bg-' },
  { find: /\bbg-orange-100\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-orange-100 dark:bg-orange-900/30', skipIf: 'dark:bg-' },
  { find: /\bbg-purple-100\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-purple-100 dark:bg-purple-900/30', skipIf: 'dark:bg-' },
  { find: /\bbg-indigo-100\b(?![\s"'`]*dark:bg-)/g, replace: 'bg-indigo-100 dark:bg-indigo-900/30', skipIf: 'dark:bg-' },

  // ── Hover backgrounds ──
  { find: /\bhover:bg-gray-50\b(?![\s"'`]*dark:hover:bg-)/g, replace: 'hover:bg-gray-50 dark:hover:bg-slate-700', skipIf: 'dark:hover:bg-' },
  { find: /\bhover:bg-gray-100\b(?![\s"'`]*dark:hover:bg-)/g, replace: 'hover:bg-gray-100 dark:hover:bg-slate-600', skipIf: 'dark:hover:bg-' },
  { find: /\bhover:bg-gray-200\b(?![\s"'`]*dark:hover:bg-)/g, replace: 'hover:bg-gray-200 dark:hover:bg-slate-600', skipIf: 'dark:hover:bg-' },

  // ── Hover text ──
  { find: /\bhover:text-gray-900\b(?![\s"'`]*dark:hover:text-)/g, replace: 'hover:text-gray-900 dark:hover:text-slate-100', skipIf: 'dark:hover:text-' },
  { find: /\bhover:text-gray-700\b(?![\s"'`]*dark:hover:text-)/g, replace: 'hover:text-gray-700 dark:hover:text-slate-300', skipIf: 'dark:hover:text-' },
  { find: /\bhover:text-blue-800\b(?![\s"'`]*dark:hover:text-)/g, replace: 'hover:text-blue-800 dark:hover:text-blue-300', skipIf: 'dark:hover:text-' },
  { find: /\bhover:text-red-800\b(?![\s"'`]*dark:hover:text-)/g, replace: 'hover:text-red-800 dark:hover:text-red-300', skipIf: 'dark:hover:text-' },
  { find: /\bhover:text-green-800\b(?![\s"'`]*dark:hover:text-)/g, replace: 'hover:text-green-800 dark:hover:text-green-300', skipIf: 'dark:hover:text-' },

  // ── Focus ring borders ──
  { find: /\bfocus:border-gray-400\b(?![\s"'`]*dark:focus:border-)/g, replace: 'focus:border-gray-400 dark:focus:border-slate-500', skipIf: 'dark:focus:border-' },

  // ── Placeholder text ──
  { find: /\bplaceholder-gray-400\b(?![\s"'`]*dark:placeholder-)/g, replace: 'placeholder-gray-400 dark:placeholder-slate-500', skipIf: 'dark:placeholder-' },

  // ── Divider / ring colours ──
  { find: /\bdivide-gray-200\b(?![\s"'`]*dark:divide-)/g, replace: 'divide-gray-200 dark:divide-slate-700', skipIf: 'dark:divide-' },
  { find: /\bring-gray-300\b(?![\s"'`]*dark:ring-)/g, replace: 'ring-gray-300 dark:ring-slate-600', skipIf: 'dark:ring-' },

  // ── Coloured borders for badges ──
  { find: /\bborder-red-200\b(?![\s"'`]*dark:border-)/g, replace: 'border-red-200 dark:border-red-800', skipIf: 'dark:border-' },
  { find: /\bborder-green-200\b(?![\s"'`]*dark:border-)/g, replace: 'border-green-200 dark:border-green-800', skipIf: 'dark:border-' },
  { find: /\bborder-yellow-200\b(?![\s"'`]*dark:border-)/g, replace: 'border-yellow-200 dark:border-yellow-800', skipIf: 'dark:border-' },
  { find: /\bborder-blue-200\b(?![\s"'`]*dark:border-)/g, replace: 'border-blue-200 dark:border-blue-800', skipIf: 'dark:border-' },
]

// ── file collection ─────────────────────────────────────────────────────────

function collectTSXFiles(dir: string): string[] {
  const results: string[] = []
  const skipDirs = new Set(['node_modules', '.next', 'dist', 'coverage', '.git', '__tests__'])

  function walk(d: string) {
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

function processLine(line: string): { modified: string; changes: string[] } {
  const changes: string[] = []
  let modified = line

  for (const rule of RULES) {
    // Only apply to strings that look like className values
    // Check if the line already has the dark variant to avoid double-adding
    if (modified.includes(rule.skipIf)) {
      // The skipIf check is per-rule, but we need to check per-occurrence
      // Actually, we should check per className string, not per line
      // For simplicity, if the line already has the dark prefix, skip this rule for this line
      continue
    }

    const before = modified
    // Reset lastIndex for global regex
    rule.find.lastIndex = 0
    modified = modified.replace(rule.find, rule.replace)
    if (modified !== before) {
      changes.push(rule.replace)
    }
  }

  return { modified, changes }
}

function processFile(filePath: string): { changed: boolean; changeCount: number } {
  const source = fs.readFileSync(filePath, 'utf8')
  const lines = source.split('\n')
  let totalChanges = 0
  const newLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    // Skip comment-only lines, import lines, and type lines
    if (
      line.trimStart().startsWith('//') ||
      line.trimStart().startsWith('*') ||
      line.trimStart().startsWith('import ') ||
      line.trimStart().startsWith('type ') ||
      line.trimStart().startsWith('interface ')
    ) {
      newLines.push(line)
      continue
    }

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

console.log(`\n🔍 Scanning ${files.length} .tsx files...`)
if (DRY_RUN) console.log('   (dry run – no files will be modified)\n')
else console.log('')

let totalFiles = 0
let totalChanges = 0

for (const file of files) {
  const { changed, changeCount } = processFile(file)
  if (changed) {
    totalFiles++
    totalChanges += changeCount
    const relPath = path.relative(ROOT, file)
    console.log(`  ✅ ${relPath} (${changeCount} fixes)`)
  }
}

console.log(`\n════════════════════════════════════════`)
console.log(`  Files modified: ${totalFiles}`)
console.log(`  Total fixes:    ${totalChanges}`)
console.log(`════════════════════════════════════════\n`)
