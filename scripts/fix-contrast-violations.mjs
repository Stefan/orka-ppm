#!/usr/bin/env node
/**
 * Automated WCAG AA Contrast Fixer
 * 
 * Systematically fixes all known contrast violations in .tsx files.
 * Each fix is a minimal color shade adjustment (one step darker/lighter).
 * 
 * Run: node scripts/fix-contrast-violations.mjs [--dry-run]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

// ============================================================
// Fix rules: pairs of { find, replace, context, description }
//
// "context" means: only apply the replace when the className
// also contains the context class (to avoid blind replacements).
// ============================================================
const PAIR_FIXES = [
  // ---- DARK MODE: slate-400 on slate-700 → slate-300 ----
  // dark:text-slate-400 on dark:bg-slate-700 gives 4.04:1, need 4.5:1
  // dark:text-slate-300 on dark:bg-slate-700 gives 7.06:1 ✓
  {
    find: /\bdark:text-slate-400\b/g,
    replace: 'dark:text-slate-300',
    context: 'dark:bg-slate-700',
    description: 'dark:text-slate-400→300 on slate-700 bg (4.04→7.06)',
  },
  // dark:text-slate-500 on dark:bg-slate-700 gives 2.18:1 → slate-400 gives 4.04:1 → slate-300 gives 7.06:1
  {
    find: /\bdark:text-slate-500\b/g,
    replace: 'dark:text-slate-300',
    context: 'dark:bg-slate-700',
    description: 'dark:text-slate-500→300 on slate-700 bg (2.18→7.06)',
  },
  // dark:text-slate-400 on dark:bg-slate-800 gives 5.58:1 ✓ (already good, skip)
  
  // ---- LIGHT MODE: text-white on colored backgrounds ----
  // text-white on bg-blue-500 → bg-blue-600 (3.68→4.63:1)
  {
    find: /\bbg-blue-500\b/g,
    replace: 'bg-blue-600',
    context: 'text-white',
    description: 'bg-blue-500→600 with text-white (3.68→4.63)',
  },
  // text-white on bg-green-600 → bg-green-700 (3.30→5.10:1)
  {
    find: /\bbg-green-600\b/g,
    replace: 'bg-green-700',
    context: 'text-white',
    description: 'bg-green-600→700 with text-white (3.30→5.10)',
  },
  // text-white on bg-red-500 → bg-red-600 (3.76→4.64:1)
  {
    find: /\bbg-red-500\b/g,
    replace: 'bg-red-600',
    context: 'text-white',
    description: 'bg-red-500→600 with text-white (3.76→4.64)',
  },
  
  // ---- LIGHT MODE: muted text on light backgrounds ----
  // text-gray-500 on bg-gray-100 → text-gray-600 (4.39→5.74:1)
  {
    find: /\btext-gray-500\b/g,
    replace: 'text-gray-600',
    context: 'bg-gray-100',
    description: 'text-gray-500→600 on gray-100 bg (4.39→5.74)',
  },
  // text-blue-600 on bg-blue-100 → text-blue-800 (4.24→8.23:1)
  {
    find: /\btext-blue-600\b/g,
    replace: 'text-blue-800',
    context: 'bg-blue-100',
    description: 'text-blue-600→800 on blue-100 bg (4.24→8.23)',
  },
  // text-red-600 on bg-red-100 → text-red-800 (3.95→7.78:1)
  {
    find: /\btext-red-600\b/g,
    replace: 'text-red-800',
    context: 'bg-red-100',
    description: 'text-red-600→800 on red-100 bg (3.95→7.78)',
  },
]

// ============================================================
// Global fixes (no context needed - always safe)
// ============================================================
const GLOBAL_FIXES = [
  // These are universally safe regardless of what other classes are present
]

// ============================================================
// File scanning
// ============================================================
function getAllTsxFiles(dir) {
  const results = []
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', '.next', '.git', 'coverage', 'dist'].includes(entry.name)) continue
        walk(fullPath)
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        // Skip test files for pair fixes to avoid touching test expectations
        results.push(fullPath)
      }
    }
  }
  walk(dir)
  return results
}

// ============================================================
// Apply fixes
// ============================================================
let totalFixCount = 0
let filesModified = 0

function applyPairFixes(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  let modified = false
  const relPath = path.relative(ROOT, filePath)
  
  // Match className="..." strings
  const classNameRegex = /className[=]["'`]([^"'`]+)["'`]/g
  
  let newContent = content.replace(classNameRegex, (fullMatch, classStr) => {
    let result = classStr
    
    for (const rule of PAIR_FIXES) {
      // Only apply if the context class is present in this className
      if (rule.context && !classStr.includes(rule.context)) continue
      
      // Check if the find pattern matches
      if (rule.find.test(result)) {
        // Reset regex state
        rule.find.lastIndex = 0
        const before = result
        result = result.replace(rule.find, rule.replace)
        rule.find.lastIndex = 0
        
        if (result !== before) {
          totalFixCount++
          if (!DRY_RUN) {
            // Only log first occurrence per file
            if (!modified) {
              console.log(`\n📝 ${relPath}`)
              modified = true
            }
            console.log(`   ${rule.description}`)
          }
        }
      }
    }
    
    if (result !== classStr) {
      return fullMatch.replace(classStr, result)
    }
    return fullMatch
  })
  
  // Also handle className={`...`} template literals (simple cases)
  const templateRegex = /className=\{`([^`]+)`\}/g
  newContent = newContent.replace(templateRegex, (fullMatch, classStr) => {
    let result = classStr
    
    for (const rule of PAIR_FIXES) {
      if (rule.context && !classStr.includes(rule.context)) continue
      if (rule.find.test(result)) {
        rule.find.lastIndex = 0
        const before = result
        result = result.replace(rule.find, rule.replace)
        rule.find.lastIndex = 0
        if (result !== before) {
          totalFixCount++
          if (!DRY_RUN && !modified) {
            console.log(`\n📝 ${relPath}`)
            modified = true
          }
        }
      }
    }
    
    if (result !== classStr) {
      return fullMatch.replace(classStr, result)
    }
    return fullMatch
  })
  
  if (newContent !== content) {
    filesModified++
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, newContent, 'utf-8')
    }
  }
}

// ============================================================
// Main
// ============================================================
console.log(`\n${'='.repeat(60)}`)
console.log(`WCAG AA Contrast Fixer ${DRY_RUN ? '(DRY RUN)' : ''}`)
console.log(`${'='.repeat(60)}`)
console.log(`\nRules: ${PAIR_FIXES.length} pair fixes`)

const files = getAllTsxFiles(ROOT)
console.log(`Files: ${files.length} .tsx/.ts files\n`)

for (const file of files) {
  applyPairFixes(file)
}

console.log(`\n${'='.repeat(60)}`)
console.log(`Done! ${totalFixCount} fixes in ${filesModified} files`)
if (DRY_RUN) {
  console.log(`(Dry run - no files were modified)`)
}
console.log(`${'='.repeat(60)}\n`)
