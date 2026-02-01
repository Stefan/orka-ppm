/**
 * Crawl project and knowledge base to build documentation for Features Overview.
 * Server-only: uses Node fs/path. Call from API route or getServerSideProps.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { DocItem } from '@/types/features'

const SKIP_APP_SEGMENTS = new Set([
  'api',
  'login',
  'forgot-password',
  'reset-password',
  'providers',
  'critical.css',
  'globals.css',
  '(auth)',
  '_next',
])

/** Derive route path from app dir path (e.g. "dashboards" -> "/dashboards", "projects/[id]" -> "/projects/[id]") */
function appDirToRoute(relativeDir: string): string {
  const segments = relativeDir.replace(/\\/g, '/').split('/').filter(Boolean)
  if (segments.length === 0) return '/'
  return '/' + segments.join('/')
}

/** Human-readable name from path segment (e.g. "monte-carlo" -> "Monte Carlo") */
function segmentToName(segment: string): string {
  return segment
    .replace(/\[.*?\]/g, ':id')
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
}

/** Extract first line starting with # or first non-empty paragraph (max len) from markdown */
function extractDescription(content: string, maxLen: number = 280): string | null {
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('# ')) return t.slice(2).trim().slice(0, maxLen) || null
    if (t.startsWith('## ')) return t.slice(3).trim().slice(0, maxLen) || null
    if (t.length > 0 && !t.startsWith('#') && !t.startsWith('[')) return t.slice(0, maxLen) || null
  }
  return null
}

/** Crawl app directory for page.tsx routes */
function crawlAppRoutes(rootDir: string): DocItem[] {
  const appDir = path.join(rootDir, 'app')
  if (!fs.existsSync(appDir)) return []

  const items: DocItem[] = []
  function walk(dir: string, relativeDir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      const rel = relativeDir ? path.join(relativeDir, e.name) : e.name
      if (e.isDirectory()) {
        if (SKIP_APP_SEGMENTS.has(e.name)) continue
        walk(full, rel)
      } else if (e.name === 'page.tsx' || e.name === 'page.js') {
        const routePath = appDirToRoute(relativeDir)
        const segment = path.basename(relativeDir)
        const name = segment ? segmentToName(segment) : 'Home'
        items.push({
          id: `route:${routePath}`,
          name: name || routePath || 'Home',
          description: null,
          link: routePath,
          source: 'route',
          sourcePath: `app/${relativeDir}/page.tsx`,
          parentId: 'section:routes',
          icon: 'Layout',
        })
      }
    }
  }
  walk(appDir, '')
  return items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

/** Crawl .kiro/specs for design/requirements */
function crawlKiroSpecs(rootDir: string): DocItem[] {
  const specsDir = path.join(rootDir, '.kiro', 'specs')
  if (!fs.existsSync(specsDir)) return []

  const items: DocItem[] = []
  const dirs = fs.readdirSync(specsDir, { withFileTypes: true }).filter((e) => e.isDirectory())
  for (const d of dirs) {
    const specName = d.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    let description: string | null = null
    for (const file of ['design.md', 'requirements.md']) {
      const p = path.join(specsDir, d.name, file)
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8')
        description = extractDescription(content)
        if (description) break
      }
    }
    items.push({
      id: `spec:${d.name}`,
      name: specName,
      description,
      link: null,
      source: 'spec',
      sourcePath: `.kiro/specs/${d.name}`,
      parentId: 'section:specs',
      icon: 'FileText',
    })
  }
  return items.sort((a, b) => a.name.localeCompare(b.name))
}

/** Crawl docs/ for markdown docs */
function crawlDocs(rootDir: string): DocItem[] {
  const docsDir = path.join(rootDir, 'docs')
  if (!fs.existsSync(docsDir)) return []

  const items: DocItem[] = []
  function walk(dir: string, relativeDir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      const rel = relativeDir ? path.join(relativeDir, e.name) : e.name
      if (e.isDirectory()) {
        walk(full, rel)
      } else if (e.name.endsWith('.md')) {
        const content = fs.readFileSync(full, 'utf-8')
        const title = extractDescription(content, 120) || segmentToName(path.basename(e.name, '.md'))
        items.push({
          id: `doc:${rel.replace(/\\/g, '/')}`,
          name: title || e.name,
          description: extractDescription(content),
          link: null,
          source: 'doc',
          sourcePath: `docs/${rel.replace(/\\/g, '/')}`,
          parentId: 'section:docs',
          icon: 'BookOpen',
        })
      }
    }
  }
  walk(docsDir, '')
  return items.sort((a, b) => a.name.localeCompare(b.name))
}

/** Section nodes for tree (virtual parents) */
const DOC_SECTIONS: DocItem[] = [
  { id: 'section:routes', name: 'App routes', description: 'Pages discovered from app/', link: null, source: 'route', sourcePath: '', parentId: null, icon: 'Layout' },
  { id: 'section:specs', name: 'Specs (.kiro/specs)', description: 'Feature specs and requirements', link: null, source: 'spec', sourcePath: '', parentId: null, icon: 'FileText' },
  { id: 'section:docs', name: 'Documentation (docs/)', description: 'Project documentation', link: null, source: 'doc', sourcePath: '', parentId: null, icon: 'BookOpen' },
]

export interface CrawlResult {
  sections: DocItem[]
  routes: DocItem[]
  specs: DocItem[]
  docs: DocItem[]
  /** Flat list: sections first, then routes, specs, docs */
  all: DocItem[]
}


/**
 * Crawl project for routes, .kiro/specs, and docs/.
 * @param rootDir - Project root (e.g. process.cwd())
 */
export function crawlProjectDocs(rootDir: string): CrawlResult {
  const routes = crawlAppRoutes(rootDir)
  const specs = crawlKiroSpecs(rootDir)
  const docs = crawlDocs(rootDir)
  const all: DocItem[] = [...DOC_SECTIONS, ...routes, ...specs, ...docs]
  return { sections: DOC_SECTIONS, routes, specs, docs, all }
}
