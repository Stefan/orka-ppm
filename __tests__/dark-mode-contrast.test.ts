/**
 * Dark/Light Mode Contrast Regression Guard
 *
 * Statically scans every .tsx file to ensure Tailwind colour utilities
 * include the appropriate `dark:` variant. This prevents regressions
 * where new code looks fine in light mode but is unreadable in dark mode.
 *
 * HOW IT WORKS:
 * - Extracts every quoted string in .tsx files that contains Tailwind classes
 * - Checks EACH string individually (not per-line) — catches ternary edge cases
 * - Reports violations grouped by file with exact line numbers
 *
 * HOW TO FIX VIOLATIONS:
 *   node scripts/fix-dark-mode.mjs          # bulk fix (main patterns)
 *   node scripts/fix-dark-mode-ternaries.mjs # fix ternary edge cases
 *
 * Run:  npx jest __tests__/dark-mode-contrast.test.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ── Config ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..')
const SCAN_DIRS = ['app', 'components']

/** Exempt files that are intentionally light-only or are showcases */
const EXEMPT_PATTERNS = [
  /design-system\/page\.tsx$/,
  /\.example\.tsx$/,
  /\.stories\.tsx$/,
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function collectTSXFiles(dir: string): string[] {
  const results: string[] = []
  const skipDirs = new Set(['node_modules', '.next', 'dist', 'coverage', '.git', '__tests__'])

  function walk(d: string) {
    if (!fs.existsSync(d)) return
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

interface StringOccurrence {
  line: number
  value: string
}

/** Extract individual quoted strings that contain Tailwind class patterns */
function extractTailwindStrings(source: string): StringOccurrence[] {
  const results: StringOccurrence[] = []
  const lines = source.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trimStart()
    // Skip non-code lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ')) continue

    // Extract each individual quoted string on this line
    const regex = /['"]([^'"]{4,})['"]/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(line)) !== null) {
      const str = m[1]!
      if (/\b(?:bg-|text-|border-)/.test(str)) {
        results.push({ line: i + 1, value: str })
      }
    }
  }

  return results
}

// ── Rules ───────────────────────────────────────────────────────────────────

interface Rule {
  label: string
  lightPattern: RegExp
  darkPrefix: string
}

const RULES: Rule[] = [
  // Backgrounds (exclude hover:/focus: prefixed variants — those use dark:hover: / dark:focus:)
  { label: 'bg-white → dark:bg-', lightPattern: /(?<!hover:|focus:)\bbg-white\b/, darkPrefix: 'dark:bg-' },
  { label: 'bg-gray-50 → dark:bg-', lightPattern: /(?<!hover:|focus:)\bbg-gray-50\b/, darkPrefix: 'dark:bg-' },
  { label: 'bg-gray-100 → dark:bg-', lightPattern: /(?<!hover:|focus:)\bbg-gray-100\b/, darkPrefix: 'dark:bg-' },

  // Gray text scale
  { label: 'text-gray-900 → dark:text-', lightPattern: /\btext-gray-900\b/, darkPrefix: 'dark:text-' },
  { label: 'text-gray-800 → dark:text-', lightPattern: /\btext-gray-800\b/, darkPrefix: 'dark:text-' },
  { label: 'text-gray-700 → dark:text-', lightPattern: /\btext-gray-700\b/, darkPrefix: 'dark:text-' },
  { label: 'text-gray-600 → dark:text-', lightPattern: /\btext-gray-600\b/, darkPrefix: 'dark:text-' },

  // Borders
  { label: 'border-gray-200 → dark:border-', lightPattern: /\bborder-gray-200\b/, darkPrefix: 'dark:border-' },
  { label: 'border-gray-300 → dark:border-', lightPattern: /\bborder-gray-300\b/, darkPrefix: 'dark:border-' },

  // Semantic text (600-level)
  { label: 'text-blue-600 → dark:text-', lightPattern: /\btext-blue-600\b/, darkPrefix: 'dark:text-' },
  { label: 'text-green-600 → dark:text-', lightPattern: /\btext-green-600\b/, darkPrefix: 'dark:text-' },
  { label: 'text-red-600 → dark:text-', lightPattern: /\btext-red-600\b/, darkPrefix: 'dark:text-' },
  { label: 'text-purple-600 → dark:text-', lightPattern: /\btext-purple-600\b/, darkPrefix: 'dark:text-' },
  { label: 'text-orange-600 → dark:text-', lightPattern: /\btext-orange-600\b/, darkPrefix: 'dark:text-' },
  { label: 'text-indigo-600 → dark:text-', lightPattern: /\btext-indigo-600\b/, darkPrefix: 'dark:text-' },

  // Semantic text (800-level)
  { label: 'text-red-800 → dark:text-', lightPattern: /\btext-red-800\b/, darkPrefix: 'dark:text-' },
  { label: 'text-green-800 → dark:text-', lightPattern: /\btext-green-800\b/, darkPrefix: 'dark:text-' },
  { label: 'text-yellow-800 → dark:text-', lightPattern: /\btext-yellow-800\b/, darkPrefix: 'dark:text-' },
  { label: 'text-blue-800 → dark:text-', lightPattern: /\btext-blue-800\b/, darkPrefix: 'dark:text-' },

  // Coloured backgrounds (badges) — exclude hover/focus prefixed
  { label: 'bg-red-100 → dark:bg-', lightPattern: /(?<!hover:|focus:)\bbg-red-100\b/, darkPrefix: 'dark:bg-' },
  { label: 'bg-green-100 → dark:bg-', lightPattern: /(?<!hover:|focus:)\bbg-green-100\b/, darkPrefix: 'dark:bg-' },
  { label: 'bg-yellow-100 → dark:bg-', lightPattern: /(?<!hover:|focus:)\bbg-yellow-100\b/, darkPrefix: 'dark:bg-' },
  { label: 'bg-blue-100 → dark:bg-', lightPattern: /(?<!hover:|focus:)\bbg-blue-100\b/, darkPrefix: 'dark:bg-' },
]

interface Violation {
  file: string
  line: number
  rule: string
  snippet: string
}

function checkString(str: string, rules: Rule[]): string[] {
  const broken: string[] = []
  for (const rule of rules) {
    if (rule.lightPattern.test(str) && !str.includes(rule.darkPrefix)) {
      broken.push(rule.label)
    }
  }
  return broken
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Dark Mode Contrast Regression Guard', () => {
  const allFiles: string[] = []
  for (const dir of SCAN_DIRS) {
    allFiles.push(...collectTSXFiles(path.join(ROOT, dir)))
  }

  const nonExemptFiles = allFiles.filter(
    (f) => !EXEMPT_PATTERNS.some((re) => re.test(f))
  )

  it(`should scan at least 100 .tsx files (found ${allFiles.length})`, () => {
    expect(allFiles.length).toBeGreaterThan(100)
  })

  // Main assertion: zero violations across all files
  it('should have zero dark mode violations across all files', () => {
    const violations: Violation[] = []

    for (const filePath of nonExemptFiles) {
      const source = fs.readFileSync(filePath, 'utf8')
      const strings = extractTailwindStrings(source)
      const relPath = path.relative(ROOT, filePath)

      for (const { line, value } of strings) {
        const broken = checkString(value, RULES)
        for (const rule of broken) {
          violations.push({
            file: relPath,
            line,
            rule,
            snippet: value.length > 80 ? value.substring(0, 80) + '...' : value,
          })
        }
      }
    }

    if (violations.length > 0) {
      // Group by file for readable output
      const byFile = new Map<string, Violation[]>()
      for (const v of violations) {
        const arr = byFile.get(v.file) || []
        arr.push(v)
        byFile.set(v.file, arr)
      }

      const report = [...byFile.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 20)
        .map(([file, vs]) => {
          const lines = vs
            .slice(0, 5)
            .map((v) => `    L${v.line}: ${v.rule}  →  "${v.snippet}"`)
            .join('\n')
          return `  ${file} (${vs.length} violations)\n${lines}`
        })
        .join('\n\n')

      const summary =
        `Found ${violations.length} dark mode violations in ${byFile.size} files.\n\n` +
        `Fix with: node scripts/fix-dark-mode.mjs && node scripts/fix-dark-mode-ternaries.mjs\n\n` +
        `Top offenders:\n${report}`

      console.error(summary)
      expect(violations.length).toBe(0)
    }

    expect(violations).toHaveLength(0)
  })

  // Bonus: check that the fixer scripts exist
  it('should have the automated fixer scripts available', () => {
    expect(fs.existsSync(path.join(ROOT, 'scripts/fix-dark-mode.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(ROOT, 'scripts/fix-dark-mode-ternaries.mjs'))).toBe(true)
  })
})
