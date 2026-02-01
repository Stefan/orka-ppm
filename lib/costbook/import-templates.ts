// Import Template Management (Task 42.3)
// Save and load CSV column mapping templates.

export interface ImportTemplate {
  id: string
  name: string
  schema: 'commitment' | 'actual'
  mapping: Record<string, string>
  createdAt: string
  updatedAt: string
  isShared?: boolean
}

const STORAGE_KEY = 'costbook-import-templates'

function loadFromStorage(): ImportTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveToStorage(templates: ImportTemplate[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // ignore
  }
}

/**
 * List all saved templates (optionally shared only).
 */
export function listTemplates(options?: { sharedOnly?: boolean }): ImportTemplate[] {
  const all = loadFromStorage()
  if (options?.sharedOnly) return all.filter(t => t.isShared)
  return all
}

/**
 * Get a template by id.
 */
export function getTemplate(id: string): ImportTemplate | null {
  return loadFromStorage().find(t => t.id === id) ?? null
}

/**
 * Save a new template.
 */
export function saveTemplate(
  name: string,
  schema: 'commitment' | 'actual',
  mapping: Record<string, string>,
  isShared = false
): ImportTemplate {
  const templates = loadFromStorage()
  const now = new Date().toISOString()
  const newId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const newTemplate: ImportTemplate = {
    id: newId,
    name,
    schema,
    mapping,
    createdAt: now,
    updatedAt: now,
    isShared
  }
  templates.push(newTemplate)
  saveToStorage(templates)
  return newTemplate
}

/**
 * Update an existing template.
 */
export function updateTemplate(
  id: string,
  updates: { name?: string; mapping?: Record<string, string>; isShared?: boolean }
): ImportTemplate | null {
  const templates = loadFromStorage()
  const idx = templates.findIndex(t => t.id === id)
  if (idx === -1) return null
  templates[idx] = {
    ...templates[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  saveToStorage(templates)
  return templates[idx]
}

/**
 * Delete a template.
 */
export function deleteTemplate(id: string): boolean {
  const templates = loadFromStorage().filter(t => t.id !== id)
  if (templates.length === loadFromStorage().length) return false
  saveToStorage(templates)
  return true
}
