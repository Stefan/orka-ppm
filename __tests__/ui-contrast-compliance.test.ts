/**
 * UI Contrast Compliance Tests
 * 
 * WCAG AA contrast checks for BOTH light and dark mode.
 * Scans .tsx files for Tailwind color class combinations and verifies:
 *  - Text-on-EXPLICIT-background contrast meets WCAG AA (4.5:1 normal, 3:1 large/bold)
 *  - Buttons are distinguishable from their likely parent background  
 *  - Dark mode (dark:) variants maintain the same standards
 *  - No "invisible" elements (white-on-white, dark-on-dark)
 * 
 * NOTE: Only checks elements with BOTH text and background in the same className.
 * Elements with text-white but no bg-* are NOT flagged (they inherit parent bg).
 */

import * as fs from 'fs'
import * as path from 'path'

// =============================================
// Tailwind color → hex mappings
// =============================================
const TAILWIND_COLORS: Record<string, string> = {
  'white': '#ffffff', 'black': '#000000',
  // Gray
  'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db', 'gray-400': '#9ca3af', 'gray-500': '#6b7280',
  'gray-600': '#4b5563', 'gray-700': '#374151', 'gray-800': '#1f2937',
  'gray-900': '#111827', 'gray-950': '#030712',
  // Slate
  'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1', 'slate-400': '#94a3b8', 'slate-500': '#64748b',
  'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b',
  'slate-900': '#0f172a', 'slate-950': '#020617',
  // Blue
  'blue-50': '#eff6ff', 'blue-100': '#dbeafe', 'blue-200': '#bfdbfe',
  'blue-300': '#93c5fd', 'blue-400': '#60a5fa', 'blue-500': '#3b82f6',
  'blue-600': '#2563eb', 'blue-700': '#1d4ed8', 'blue-800': '#1e40af',
  'blue-900': '#1e3a8a',
  // Indigo
  'indigo-50': '#eef2ff', 'indigo-100': '#e0e7ff', 'indigo-200': '#c7d2fe',
  'indigo-500': '#6366f1', 'indigo-600': '#4f46e5', 'indigo-700': '#4338ca',
  'indigo-800': '#3730a3', 'indigo-900': '#312e81', 'indigo-950': '#1e1b4b',
  // Red
  'red-50': '#fef2f2', 'red-100': '#fee2e2', 'red-200': '#fecaca',
  'red-300': '#fca5a5', 'red-400': '#f87171', 'red-500': '#ef4444',
  'red-600': '#dc2626', 'red-700': '#b91c1c', 'red-800': '#991b1b',
  'red-900': '#7f1d1d',
  // Green
  'green-50': '#f0fdf4', 'green-100': '#dcfce7', 'green-200': '#bbf7d0',
  'green-400': '#4ade80', 'green-500': '#22c55e', 'green-600': '#16a34a',
  'green-700': '#15803d', 'green-800': '#166534', 'green-900': '#14532d',
  // Yellow / Amber / Orange
  'yellow-400': '#facc15', 'yellow-500': '#eab308', 'yellow-600': '#ca8a04',
  'yellow-700': '#a16207', 'yellow-800': '#854d0e',
  'amber-400': '#fbbf24', 'amber-500': '#f59e0b', 'amber-600': '#d97706',
  'amber-800': '#92400e', 'amber-900': '#78350f',
  'orange-400': '#fb923c', 'orange-500': '#f97316', 'orange-600': '#ea580c',
  'orange-800': '#9a3412',
}

// =============================================
// WCAG Contrast Calculation
// =============================================
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '')
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16),
  ]
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// =============================================
// Color extraction from Tailwind classes
// =============================================
function resolveColor(colorName: string): string | null {
  return TAILWIND_COLORS[colorName] ?? null
}

interface ColorPair {
  textColor: string | null
  textColorClass: string
  bgColor: string | null
  bgColorClass: string
  borderColor: string | null
  borderColorClass: string
}

function extractColorPairs(className: string): { light: ColorPair; dark: ColorPair } {
  const classes = className.split(/\s+/)
  const light: ColorPair = { textColor: null, textColorClass: '', bgColor: null, bgColorClass: '', borderColor: null, borderColorClass: '' }
  const dark: ColorPair = { textColor: null, textColorClass: '', bgColor: null, bgColorClass: '', borderColor: null, borderColorClass: '' }
  
  for (const cls of classes) {
    if (cls.includes('hover:') || cls.includes('focus:') || cls.includes('group-hover:') || cls.includes('active:') || cls.includes('placeholder:')) continue
    
    if (cls.startsWith('dark:')) {
      const inner = cls.replace('dark:', '')
      if (inner.startsWith('text-')) {
        const hex = resolveColor(inner.replace('text-', ''))
        if (hex) { dark.textColor = hex; dark.textColorClass = cls }
      } else if (inner.startsWith('bg-') && !inner.includes('/')) {
        const hex = resolveColor(inner.replace('bg-', ''))
        if (hex) { dark.bgColor = hex; dark.bgColorClass = cls }
      } else if (inner.startsWith('border-') && !inner.includes('/')) {
        const hex = resolveColor(inner.replace('border-', ''))
        if (hex) { dark.borderColor = hex; dark.borderColorClass = cls }
      }
    } else {
      if (cls.startsWith('text-') && !cls.includes('[')) {
        const hex = resolveColor(cls.replace('text-', ''))
        if (hex) { light.textColor = hex; light.textColorClass = cls }
      } else if (cls.startsWith('bg-') && !cls.includes('[') && !cls.includes('/')) {
        const hex = resolveColor(cls.replace('bg-', ''))
        if (hex) { light.bgColor = hex; light.bgColorClass = cls }
      } else if (cls.startsWith('border-') && !cls.includes('[') && !cls.includes('/')) {
        const hex = resolveColor(cls.replace('border-', ''))
        if (hex) { light.borderColor = hex; light.borderColorClass = cls }
      }
    }
  }
  return { light, dark }
}

// =============================================
// File scanning
// =============================================
function getAllTsxFiles(dir: string): string[] {
  const results: string[] = []
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', '.next', '.git', 'coverage', 'dist'].includes(entry.name)) continue
        walk(fullPath)
      } else if (entry.name.endsWith('.tsx')) {
        results.push(fullPath)
      }
    }
  }
  walk(dir)
  return results
}

interface ContrastViolation {
  file: string
  line: number
  mode: 'light' | 'dark'
  type: 'text-on-bg' | 'invisible-button'
  ratio: number
  required: number
  details: string
}

/**
 * Only check contrast when BOTH text and bg are explicitly set on the SAME element.
 * This avoids false positives from inherited backgrounds.
 */
function scanFileForExplicitViolations(filePath: string): ContrastViolation[] {
  const violations: ContrastViolation[] = []
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const relPath = path.relative(process.cwd(), filePath)
  
  const classNameRegex = /className[=]["'`]([^"'`]+)["'`]/g
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    classNameRegex.lastIndex = 0
    let match
    
    while ((match = classNameRegex.exec(line)) !== null) {
      const classStr = match[1]
      if (classStr.includes('${')) continue // skip template literals
      
      const { light, dark } = extractColorPairs(classStr)
      const isBoldOrLarge = /font-bold|font-semibold|text-2xl|text-3xl|text-xl/.test(classStr)
      const required = isBoldOrLarge ? 3.0 : 4.5
      
      // LIGHT MODE: text + bg on same element
      if (light.textColor && light.bgColor) {
        const ratio = contrastRatio(light.textColor, light.bgColor)
        if (ratio < required) {
          violations.push({
            file: relPath, line: i + 1, mode: 'light', type: 'text-on-bg',
            ratio: Math.round(ratio * 100) / 100, required,
            details: `${light.textColorClass} on ${light.bgColorClass} → ${ratio.toFixed(2)}:1 (need ${required}:1)`
          })
        }
      }
      
      // DARK MODE: text + bg on same element
      if (dark.textColor && dark.bgColor) {
        const ratio = contrastRatio(dark.textColor, dark.bgColor)
        if (ratio < required) {
          violations.push({
            file: relPath, line: i + 1, mode: 'dark', type: 'text-on-bg',
            ratio: Math.round(ratio * 100) / 100, required,
            details: `${dark.textColorClass} on ${dark.bgColorClass} → ${ratio.toFixed(2)}:1 (need ${required}:1)`
          })
        }
      }
      
      // INVISIBLE BUTTON: bg-white + light border on actual <button> elements
      // Cards with cursor-pointer + hover:shadow are excluded (shadow provides affordance)
      const isActualButton = line.includes('<button')
      const hasHoverShadow = classStr.includes('hover:shadow')
      if (isActualButton && !hasHoverShadow && light.bgColor === '#ffffff' && light.borderColor) {
        const borderVsWhite = contrastRatio(light.borderColor, '#ffffff')
        if (borderVsWhite < 1.5) {
          violations.push({
            file: relPath, line: i + 1, mode: 'light', type: 'invisible-button',
            ratio: Math.round(borderVsWhite * 100) / 100, required: 1.5,
            details: `Button: ${light.bgColorClass} + ${light.borderColorClass} → border barely visible (${borderVsWhite.toFixed(2)}:1, need 1.5:1)`
          })
        }
      }
    }
  }
  return violations
}

// =============================================
// TESTS
// =============================================

describe('UI Contrast Compliance (WCAG AA)', () => {
  const rootDir = process.cwd()
  const tsxFiles = getAllTsxFiles(rootDir)
  
  it('should scan a significant number of component files', () => {
    expect(tsxFiles.length).toBeGreaterThan(50)
    console.log(`Scanning ${tsxFiles.length} .tsx files for contrast violations...`)
  })

  describe('Light Mode — explicit text+bg on same element', () => {
    let lightViolations: ContrastViolation[] = []
    
    beforeAll(() => {
      for (const file of tsxFiles) {
        lightViolations.push(...scanFileForExplicitViolations(file).filter(v => v.mode === 'light'))
      }
    })
    
    it('should have no WCAG AA text contrast violations (ratio < 4.5:1 or < 3:1 for bold/large)', () => {
      const violations = lightViolations.filter(v => v.type === 'text-on-bg')
      if (violations.length > 0) {
        const report = violations.sort((a, b) => a.ratio - b.ratio)
          .map(v => `  ${v.file}:${v.line} — ${v.details}`).join('\n')
        console.warn(`\nLight mode WCAG AA violations (${violations.length}):\n${report}\n`)
      }
      expect(violations).toHaveLength(0)
    })
    
    it('should have no invisible buttons (white bg + light border)', () => {
      const invisible = lightViolations.filter(v => v.type === 'invisible-button')
      if (invisible.length > 0) {
        const report = invisible.map(v => `  ${v.file}:${v.line} — ${v.details}`).join('\n')
        console.warn(`\nInvisible buttons (${invisible.length}):\n${report}\n`)
      }
      expect(invisible).toHaveLength(0)
    })
  })

  describe('Dark Mode — explicit text+bg on same element', () => {
    let darkViolations: ContrastViolation[] = []
    
    beforeAll(() => {
      for (const file of tsxFiles) {
        darkViolations.push(...scanFileForExplicitViolations(file).filter(v => v.mode === 'dark'))
      }
    })
    
    it('should have no WCAG AA text contrast violations (ratio < 4.5:1 or < 3:1 for bold/large)', () => {
      const violations = darkViolations.filter(v => v.type === 'text-on-bg')
      if (violations.length > 0) {
        const report = violations.sort((a, b) => a.ratio - b.ratio)
          .map(v => `  ${v.file}:${v.line} — ${v.details}`).join('\n')
        console.warn(`\nDark mode WCAG AA violations (${violations.length}):\n${report}\n`)
      }
      expect(violations).toHaveLength(0)
    })
  })

  describe('Specific high-risk areas', () => {
    it('Quick Actions bar: secondary buttons must NOT use bg-white', () => {
      const file = path.join(rootDir, 'app/dashboards/page.tsx')
      if (!fs.existsSync(file)) return
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const qaStart = lines.findIndex(l => l.includes('dashboard-quick-actions'))
      expect(qaStart).toBeGreaterThan(-1)
      
      const qaSection = lines.slice(qaStart, qaStart + 50).join('\n')
      // Count bg-white buttons (exclude the bar container itself)
      const bgWhiteButtons = (qaSection.match(/<button[^>]*bg-white/g) || [])
      expect(bgWhiteButtons).toHaveLength(0)
    })
    
    it('Quick Actions bar: text should be at least gray-800 for readability', () => {
      const file = path.join(rootDir, 'app/dashboards/page.tsx')
      if (!fs.existsSync(file)) return
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const qaStart = lines.findIndex(l => l.includes('dashboard-quick-actions'))
      const qaSection = lines.slice(qaStart, qaStart + 50).join('\n')
      
      // Secondary buttons should use text-gray-800 or darker
      const hasGoodText = qaSection.includes('text-gray-800') || qaSection.includes('text-gray-900')
      expect(hasGoodText).toBe(true)
    })
    
    it('TopBar: dropdown items should have visible hover effects', () => {
      const file = path.join(rootDir, 'components/navigation/TopBar.tsx')
      if (!fs.existsSync(file)) return
      const content = fs.readFileSync(file, 'utf-8')
      
      expect(content).toMatch(/dropdownItemInactive.*hover:bg-/)
      expect(content).toMatch(/navLinkInactive.*hover:bg-/)
    })
    
    it('TopBar: should close other dropdowns when opening one', () => {
      const file = path.join(rootDir, 'components/navigation/TopBar.tsx')
      if (!fs.existsSync(file)) return
      const content = fs.readFileSync(file, 'utf-8')
      
      expect(content).toMatch(/toggleDropdown|closeAllDropdowns/)
    })
    
    it('TopBar: should have distinct style for open-but-not-active dropdown buttons', () => {
      const file = path.join(rootDir, 'components/navigation/TopBar.tsx')
      if (!fs.existsSync(file)) return
      const content = fs.readFileSync(file, 'utf-8')
      
      expect(content).toMatch(/navLinkOpen/)
    })
    
    it('TabNavigation: inactive tabs should use at least gray-800 text', () => {
      const file = path.join(rootDir, 'app/financials/components/TabNavigation.tsx')
      if (!fs.existsSync(file)) return
      const content = fs.readFileSync(file, 'utf-8')
      
      const hasStrongText = content.includes('text-gray-900') || content.includes('text-gray-800')
      expect(hasStrongText).toBe(true)
    })
    
    it('no globals.css class-based dark mode overrides with !important', () => {
      const file = path.join(rootDir, 'app/globals.css')
      const content = fs.readFileSync(file, 'utf-8')
      
      // Should NOT have class-based dark mode overrides
      expect(content).not.toMatch(/html\.dark\s+\.bg-white/)
      expect(content).not.toMatch(/html\.dark\s+\.text-gray/)
      expect(content).not.toMatch(/html\.dark\s+\.border-gray/)
      expect(content).not.toMatch(/html\.dark\s+h[1-6]\s*\{/)
      expect(content).not.toMatch(/html\.dark\s+a:not/)
    })
    
    it('critical.css should not have unlayered Tailwind class definitions', () => {
      const file = path.join(rootDir, 'app/critical.css')
      const content = fs.readFileSync(file, 'utf-8')
      
      // Should NOT have unlayered .flex, .text-gray-900, etc.
      const unlayeredClassDefs = content.split('@layer')[0] // content before first @layer
      expect(unlayeredClassDefs).not.toMatch(/\.(flex|grid|text-gray|bg-white|rounded|shadow|border-gray)\s*\{/)
    })
    
    it('globals.css and critical.css: all element resets must be inside @layer base', () => {
      // Unlayered element resets (e.g., `a { color: inherit }`) override
      // Tailwind v4 utilities because unlayered CSS always beats @layer utilities.
      // This breaks hover effects on <a> elements, border utilities on <button>, etc.
      const filesToCheck = [
        path.join(rootDir, 'app/globals.css'),
        path.join(rootDir, 'app/critical.css'),
      ]
      
      for (const file of filesToCheck) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')
        const relPath = path.relative(rootDir, file)
        
        // Extract content OUTSIDE of @layer blocks and @import statements
        // Remove comments first
        const noComments = content.replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove @import lines
        const noImports = noComments.replace(/@import\s+[^;]+;/g, '')
        // Remove @layer blocks (including nested content)
        let outsideLayer = noImports
        let depth = 0
        let result = ''
        let inLayer = false
        for (let i = 0; i < outsideLayer.length; i++) {
          if (outsideLayer.substring(i).startsWith('@layer')) {
            inLayer = true
          }
          if (inLayer) {
            if (outsideLayer[i] === '{') depth++
            if (outsideLayer[i] === '}') {
              depth--
              if (depth === 0) inLayer = false
            }
          } else {
            result += outsideLayer[i]
          }
        }
        
        // Check that no CSS rules with property-setting declarations exist outside @layer
        // Allowed: @theme, @import, empty lines, comments
        const hasUnlayeredRules = /\b(html|body|button|a|input|select|textarea)\s*\{[^}]*\b(color|background|border|font)\b/i.test(result)
        expect(hasUnlayeredRules).toBe(false)
      }
    })
  })

  describe('Cross-mode consistency for interactive elements', () => {
    it('buttons with text-gray-* should have dark:text-* variant', () => {
      const missing: string[] = []
      
      for (const file of tsxFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        const relPath = path.relative(rootDir, file)
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (!line.includes('<button')) continue
          
          const classMatch = line.match(/className[=]["'`]([^"'`]+)["'`]/)
          if (!classMatch) continue
          
          const classes = classMatch[1]
          if (/\btext-gray-\d{2,3}\b/.test(classes) && !/dark:text-/.test(classes)) {
            missing.push(`${relPath}:${i + 1}`)
          }
        }
      }
      
      if (missing.length > 0) {
        console.warn(`\nButtons with text-gray-* but no dark:text-* (${missing.length}):\n${missing.slice(0, 10).map(v => `  ${v}`).join('\n')}\n`)
      }
      
      expect(missing.length).toBeLessThan(5)
    })
  })
})
