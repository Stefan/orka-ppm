/**
 * Production Readiness: Client API URLs and App Import Paths
 *
 * Prevents regressions that only surface in production:
 * 1. Client-side code must not call a hardcoded backend URL (e.g. localhost:8001)
 *    so that production (Vercel) doesn't try to fetch from the user's machine.
 * 2. App routes must import shared components via @/components, not relative
 *    paths like ../../components/..., which break the build when app/ depth changes.
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(process.cwd())

/** Client-side API modules that must not call backend directly (use same-origin /api proxy) */
const CLIENT_SIDE_API_FILES = ['lib/help-chat-api.ts']

/** Client components/hooks that must use getApiUrl (same-origin); must not contain unguarded localhost */
const CLIENT_SIDE_GET_API_URL_FILES = [
  'components/auth/ViewerIndicator.tsx',
  'components/admin/EffectivePermissionsDisplay.tsx',
  'components/admin/UserRoleManagement.tsx',
  'components/admin/RoleManagement.tsx',
  'components/admin/RoleCreation.tsx',
  'components/admin/RoleAssignmentDialog.tsx',
]

/** Allowed: same-origin in browser (empty string when window is defined) */
const BROWSER_GUARD = /typeof\s+window\s*!==\s*['"]undefined['"]\s*\?\s*['"]['"]/

/** Match relative import like from '../../components/...' or from '../components/...' */
const RELATIVE_IMPORT_TO_COMPONENTS = /from\s+['"]((\.\.\/)+)(components\/[^'"]+)['"]/g

function readFile(filePath: string): string {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf-8')
}

function findAppTsxFiles(dir: string, list: string[]): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    const rel = path.relative(ROOT, full)
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.next' && e.name !== '__tests__') {
        findAppTsxFiles(full, list)
      }
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      list.push(rel)
    }
  }
}

/** True if import resolves to app/components/ (missing; use @/components or correct ../ count). */
function isBrokenAppComponentsImport(fromFile: string, relativeImport: string): boolean {
  const dir = path.dirname(path.join(ROOT, fromFile))
  const resolved = path.normalize(path.join(dir, relativeImport))
  const wrongPath = path.join(ROOT, 'app', 'components')
  return resolved.startsWith(wrongPath + path.sep) || resolved === wrongPath
}

describe('Production Readiness: Client API URLs', () => {
  test.each(CLIENT_SIDE_API_FILES)(
    '%s must not use unguarded localhost backend URL (use same-origin in browser)',
    (file) => {
      const content = readFile(file)
      const hasUnguardedLocalhost =
        content.includes("localhost:8001") || content.includes('localhost:8000')
      const hasBrowserGuard =
        BROWSER_GUARD.test(content) || content.includes("typeof window !== 'undefined'")
      if (hasUnguardedLocalhost && !hasBrowserGuard) {
        expect(content).toMatch(BROWSER_GUARD)
      }
      expect(hasBrowserGuard || !hasUnguardedLocalhost).toBe(true)
    }
  )

  test.each(CLIENT_SIDE_GET_API_URL_FILES)(
    '%s must use getApiUrl for API calls (no unguarded localhost)',
    (file) => {
      const content = readFile(file)
      const hasUnguardedLocalhost =
        content.includes("localhost:8001") || content.includes('localhost:8000')
      const usesGetApiUrl = content.includes('getApiUrl(')
      expect(usesGetApiUrl).toBe(true)
      expect(hasUnguardedLocalhost).toBe(false)
    }
  )
})

describe('Production Readiness: App import paths', () => {
  test('app/** relative imports to components/ must resolve to project components/ (not app/components/)', () => {
    const appDir = path.join(ROOT, 'app')
    const files: string[] = []
    findAppTsxFiles(appDir, files)
    const violations: { file: string; line: number; importPath: string }[] = []
    for (const rel of files) {
      const content = readFile(rel)
      const lines = content.split('\n')
      lines.forEach((line, i) => {
        let m: RegExpExecArray | null
        RELATIVE_IMPORT_TO_COMPONENTS.lastIndex = 0
        while ((m = RELATIVE_IMPORT_TO_COMPONENTS.exec(line)) !== null) {
          const prefix = m[1]
          const rest = m[3]
          const fullImport = `${prefix}${rest}`
          if (isBrokenAppComponentsImport(rel, fullImport)) {
            violations.push({ file: rel, line: i + 1, importPath: fullImport })
          }
        }
      })
    }
    expect(violations).toEqual([])
  })
})
