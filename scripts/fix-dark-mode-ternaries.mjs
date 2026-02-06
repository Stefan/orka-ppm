#!/usr/bin/env node
/**
 * Fix dark mode variants inside individual string literals (ternary edge cases)
 * 
 * This handles cases like:
 *   condition ? 'text-green-600 dark:text-green-400' : 'text-red-600'
 * where the line-level check misses the second string because the first already has dark:
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.resolve(__dirname, '..')

// Per-string replacement rules (only applied within individual string boundaries)
const STRING_RULES = [
  // Text colors (600-level)
  { find: /\btext-red-600\b/, dark: ' dark:text-red-400', skipIf: 'dark:text-' },
  { find: /\btext-green-600\b/, dark: ' dark:text-green-400', skipIf: 'dark:text-' },
  { find: /\btext-blue-600\b/, dark: ' dark:text-blue-400', skipIf: 'dark:text-' },
  { find: /\btext-yellow-600\b/, dark: ' dark:text-yellow-400', skipIf: 'dark:text-' },
  { find: /\btext-orange-600\b/, dark: ' dark:text-orange-400', skipIf: 'dark:text-' },
  { find: /\btext-purple-600\b/, dark: ' dark:text-purple-400', skipIf: 'dark:text-' },

  // Text colors (800-level)
  { find: /\btext-red-800\b/, dark: ' dark:text-red-300', skipIf: 'dark:text-' },
  { find: /\btext-green-800\b/, dark: ' dark:text-green-300', skipIf: 'dark:text-' },
  { find: /\btext-blue-800\b/, dark: ' dark:text-blue-300', skipIf: 'dark:text-' },
  { find: /\btext-yellow-800\b/, dark: ' dark:text-yellow-300', skipIf: 'dark:text-' },
  
  // Text colors (500-level)
  { find: /\btext-red-500\b/, dark: ' dark:text-red-400', skipIf: 'dark:text-' },
  { find: /\btext-yellow-500\b/, dark: ' dark:text-yellow-400', skipIf: 'dark:text-' },
  { find: /\btext-green-500\b/, dark: ' dark:text-green-400', skipIf: 'dark:text-' },
  { find: /\btext-blue-500\b/, dark: ' dark:text-blue-400', skipIf: 'dark:text-' },

  // Gray text
  { find: /\btext-gray-600\b/, dark: ' dark:text-slate-400', skipIf: 'dark:text-' },
  { find: /\btext-gray-400\b/, dark: ' dark:text-slate-500', skipIf: 'dark:text-' },
  { find: /\btext-gray-500\b/, dark: ' dark:text-slate-400', skipIf: 'dark:text-' },

  // Backgrounds
  { find: /\bbg-red-50\b/, dark: ' dark:bg-red-900/20', skipIf: 'dark:bg-' },
  { find: /\bbg-green-50\b/, dark: ' dark:bg-green-900/20', skipIf: 'dark:bg-' },
  { find: /\bbg-blue-50\b/, dark: ' dark:bg-blue-900/20', skipIf: 'dark:bg-' },
  { find: /\bbg-yellow-50\b/, dark: ' dark:bg-yellow-900/20', skipIf: 'dark:bg-' },

  // Borders  
  { find: /\bborder-red-200\b/, dark: ' dark:border-red-800', skipIf: 'dark:border-' },
  { find: /\bborder-green-200\b/, dark: ' dark:border-green-800', skipIf: 'dark:border-' },
  { find: /\bborder-blue-200\b/, dark: ' dark:border-blue-800', skipIf: 'dark:border-' },
  { find: /\bborder-yellow-200\b/, dark: ' dark:border-yellow-800', skipIf: 'dark:border-' },
  { find: /\bborder-red-400\b/, dark: ' dark:border-red-600', skipIf: 'dark:border-' },
  { find: /\bborder-blue-400\b/, dark: ' dark:border-blue-600', skipIf: 'dark:border-' },
  { find: /\bborder-green-400\b/, dark: ' dark:border-green-600', skipIf: 'dark:border-' },
  { find: /\bborder-green-300\b/, dark: ' dark:border-green-700', skipIf: 'dark:border-' },
  { find: /\bborder-red-300\b/, dark: ' dark:border-red-700', skipIf: 'dark:border-' },
]

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

function fixStringLiterals(content) {
  let changes = 0

  // Match all single-quoted and double-quoted strings that contain Tailwind-like classes
  const result = content.replace(/(['"])([^'"]{4,})\1/g, (fullMatch, quote, inner) => {
    // Only process strings that look like Tailwind classes
    if (!/(?:text-|bg-|border-)/.test(inner)) return fullMatch

    let modified = inner
    for (const rule of STRING_RULES) {
      if (rule.find.test(modified) && !modified.includes(rule.skipIf)) {
        modified = modified.replace(rule.find, (m) => m + rule.dark)
        changes++
      }
    }

    if (modified !== inner) {
      return quote + modified + quote
    }
    return fullMatch
  })

  return { result, changes }
}

// Main
const files = [
  ...collectTSXFiles(path.join(ROOT, 'app')),
  ...collectTSXFiles(path.join(ROOT, 'components')),
]

console.log(`\nScanning ${files.length} .tsx files for ternary edge cases...`)
if (DRY_RUN) console.log('   (dry run)\n')

let totalFiles = 0
let totalChanges = 0

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  const { result, changes } = fixStringLiterals(content)

  if (changes > 0) {
    totalFiles++
    totalChanges += changes
    if (!DRY_RUN) {
      fs.writeFileSync(file, result, 'utf8')
    }
    console.log(`  ${path.relative(ROOT, file)} (${changes} fixes)`)
  }
}

console.log(`\n========================================`)
console.log(`  Files modified: ${totalFiles}`)
console.log(`  Total fixes:    ${totalChanges}`)
console.log(`========================================\n`)
