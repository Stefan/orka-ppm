/**
 * API contract schemas for consumer tests
 * Enterprise Test Strategy - Section 3
 * Validates frontend expectations against backend API response shapes.
 * Regenerate or align with backend OpenAPI when schema changes.
 */

export type ValidationResult = { valid: true } | { valid: false; errors: string[] }

function ok(): ValidationResult {
  return { valid: true }
}

function err(messages: string[]): ValidationResult {
  return { valid: false, errors: messages }
}

/** Health endpoint: at least status and timestamp */
export function validateHealthResponse(data: unknown): ValidationResult {
  if (data === null || typeof data !== 'object') {
    return err(['Health response must be an object'])
  }
  const o = data as Record<string, unknown>
  const errors: string[] = []
  if (typeof o.status !== 'string') errors.push('health.status must be string')
  if (typeof o.timestamp !== 'string') errors.push('health.timestamp must be string')
  return errors.length ? err(errors) : ok()
}

/** Project item: id, name, status required; budget, created_at optional but typed when present */
export function validateProjectItem(project: unknown): ValidationResult {
  if (project === null || typeof project !== 'object') {
    return err(['Project item must be an object'])
  }
  const p = project as Record<string, unknown>
  const errors: string[] = []
  if (typeof p.id !== 'string' && typeof p.id !== 'number') errors.push('project.id must be string or number')
  if (typeof p.name !== 'string') errors.push('project.name must be string')
  if (typeof p.status !== 'string') errors.push('project.status must be string')
  if (p.budget !== undefined && typeof p.budget !== 'number') errors.push('project.budget must be number when present')
  if (p.created_at !== undefined && typeof p.created_at !== 'string') errors.push('project.created_at must be string when present')
  return errors.length ? err(errors) : ok()
}

/** Projects list: array or { projects: array } */
export function validateProjectsResponse(data: unknown): ValidationResult {
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const r = validateProjectItem(data[i])
      if (!r.valid) return { valid: false, errors: r.errors.map((e) => `[${i}] ${e}`) }
    }
    return ok()
  }
  if (data !== null && typeof data === 'object' && 'projects' in data) {
    const arr = (data as { projects: unknown }).projects
    if (!Array.isArray(arr)) return err(['projects must be an array'])
    for (let i = 0; i < arr.length; i++) {
      const r = validateProjectItem(arr[i])
      if (!r.valid) return { valid: false, errors: r.errors.map((e) => `projects[${i}] ${e}`) }
    }
    return ok()
  }
  if (data !== null && typeof data === 'object' && 'data' in data) {
    const arr = (data as { data: unknown }).data
    if (!Array.isArray(arr)) return err(['data must be an array'])
    for (let i = 0; i < arr.length; i++) {
      const r = validateProjectItem(arr[i])
      if (!r.valid) return { valid: false, errors: r.errors.map((e) => `data[${i}] ${e}`) }
    }
    return ok()
  }
  return err(['Projects response must be an array or { projects: array } or { data: array }'])
}

/** Help-Chat query response: response, sessionId, sources, confidence, responseTimeMs */
export function validateHelpQueryResponse(data: unknown): ValidationResult {
  if (data === null || typeof data !== 'object') {
    return err(['Help query response must be an object'])
  }
  const o = data as Record<string, unknown>
  const errors: string[] = []
  if (typeof o.response !== 'string') errors.push('response must be string')
  if (typeof o.sessionId !== 'string') errors.push('sessionId must be string')
  if (!Array.isArray(o.sources)) errors.push('sources must be array')
  if (typeof o.confidence !== 'number') errors.push('confidence must be number')
  if (typeof o.responseTimeMs !== 'number') errors.push('responseTimeMs must be number')
  return errors.length ? err(errors) : ok()
}
