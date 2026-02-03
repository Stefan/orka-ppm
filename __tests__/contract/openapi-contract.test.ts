/**
 * OpenAPI-driven contract test: validate committed or generated openapi.json
 * Enterprise Gaps Plan - Optional. Run scripts/export-openapi.sh to refresh from backend.
 */
import * as fs from 'fs'
import * as path from 'path'
import { validateHealthResponse, validateProjectsResponse } from './schemas'

const openapiPath = path.join(__dirname, 'openapi.json')

function loadOpenAPI(): Record<string, unknown> | null {
  if (!fs.existsSync(openapiPath)) return null
  const raw = fs.readFileSync(openapiPath, 'utf-8')
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

describe('Contract: OpenAPI schema', () => {
  const openapi = loadOpenAPI()

  it('has openapi.json with paths for health and projects', () => {
    if (!openapi) {
      console.warn('No openapi.json found; run scripts/export-openapi.sh to generate')
      return
    }
    const paths = openapi.paths as Record<string, unknown> | undefined
    expect(paths).toBeDefined()
    expect(paths!['/health']).toBeDefined()
    const healthGet = (paths!['/health'] as Record<string, unknown>)?.get as Record<string, unknown> | undefined
    expect(healthGet?.responses).toBeDefined()
    expect((healthGet?.responses as Record<string, unknown>)!['200']).toBeDefined()
    expect(paths!['/projects']).toBeDefined()
  })

  it('health fixture validates against contract schema expectation', () => {
    const fixture = { status: 'healthy', timestamp: new Date().toISOString() }
    const result = validateHealthResponse(fixture)
    expect(result.valid).toBe(true)
  })

  it('projects array fixture validates against contract expectation', () => {
    const fixture = [{ id: '1', name: 'P1', status: 'active' }]
    const result = validateProjectsResponse(fixture)
    expect(result.valid).toBe(true)
  })
})
