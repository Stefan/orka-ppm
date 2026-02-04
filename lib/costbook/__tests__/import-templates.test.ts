/**
 * @jest-environment jsdom
 */
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  type ImportTemplate
} from '../import-templates'

const STORAGE_KEY = 'costbook-import-templates'

describe('lib/costbook/import-templates', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storage[key] ?? null)
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      storage[key] = value
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('listTemplates', () => {
    it('returns empty array when storage is empty', () => {
      expect(listTemplates()).toEqual([])
    })

    it('returns all templates when options not passed', () => {
      storage[STORAGE_KEY] = JSON.stringify([
        { id: '1', name: 'A', schema: 'commitment', mapping: {}, createdAt: '', updatedAt: '' }
      ])
      expect(listTemplates()).toHaveLength(1)
      expect(listTemplates(undefined)).toHaveLength(1)
    })

    it('returns empty array when storage has invalid JSON', () => {
      storage[STORAGE_KEY] = 'not valid json'
      expect(listTemplates()).toEqual([])
    })

    it('returns all templates from storage', () => {
      const tpl: ImportTemplate = {
        id: 't1',
        name: 'T1',
        schema: 'commitment',
        mapping: { a: 'b' },
        createdAt: '2020-01-01',
        updatedAt: '2020-01-01'
      }
      storage[STORAGE_KEY] = JSON.stringify([tpl])
      expect(listTemplates()).toHaveLength(1)
      expect(listTemplates()[0].name).toBe('T1')
    })

    it('filters by sharedOnly when true', () => {
      storage[STORAGE_KEY] = JSON.stringify([
        { id: '1', name: 'A', schema: 'commitment', mapping: {}, createdAt: '', updatedAt: '', isShared: true },
        { id: '2', name: 'B', schema: 'actual', mapping: {}, createdAt: '', updatedAt: '', isShared: false }
      ])
      expect(listTemplates({ sharedOnly: true })).toHaveLength(1)
      expect(listTemplates({ sharedOnly: true })[0].name).toBe('A')
    })
  })

  describe('getTemplate', () => {
    it('returns null when not found', () => {
      expect(getTemplate('missing')).toBeNull()
    })

    it('returns template by id', () => {
      storage[STORAGE_KEY] = JSON.stringify([
        { id: 't1', name: 'T1', schema: 'commitment', mapping: {}, createdAt: '', updatedAt: '' }
      ])
      expect(getTemplate('t1')?.name).toBe('T1')
    })
  })

  describe('saveTemplate', () => {
    it('creates new template with id and timestamps', () => {
      const result = saveTemplate('My Template', 'commitment', { col1: 'field1' })
      expect(result.name).toBe('My Template')
      expect(result.schema).toBe('commitment')
      expect(result.mapping).toEqual({ col1: 'field1' })
      expect(result.id).toMatch(/^tpl-\d+-/)
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    it('persists to storage', () => {
      saveTemplate('T', 'actual', { x: 'y' })
      const list = listTemplates()
      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('T')
    })

    it('accepts isShared', () => {
      const result = saveTemplate('S', 'commitment', {}, true)
      expect(result.isShared).toBe(true)
    })
  })

  describe('updateTemplate', () => {
    it('returns null when id not found', () => {
      expect(updateTemplate('missing', { name: 'X' })).toBeNull()
    })

    it('updates name and updatedAt', () => {
      saveTemplate('Original', 'commitment', {})
      const list = listTemplates()
      const id = list[0].id
      const updated = updateTemplate(id, { name: 'Updated' })
      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Updated')
      expect(updated!.updatedAt).toBeDefined()
    })

    it('updates mapping', () => {
      saveTemplate('T', 'commitment', { a: 'b' })
      const id = listTemplates()[0].id
      updateTemplate(id, { mapping: { x: 'y' } })
      expect(getTemplate(id)!.mapping).toEqual({ x: 'y' })
    })

    it('updates isShared', () => {
      saveTemplate('T', 'commitment', {}, false)
      const id = listTemplates()[0].id
      updateTemplate(id, { isShared: true })
      expect(getTemplate(id)!.isShared).toBe(true)
    })
  })

  describe('deleteTemplate', () => {
    it('returns false when id not found', () => {
      expect(deleteTemplate('missing')).toBe(false)
    })

    it('removes template and returns true', () => {
      saveTemplate('T', 'commitment', {})
      const id = listTemplates()[0].id
      expect(deleteTemplate(id)).toBe(true)
      expect(listTemplates()).toHaveLength(0)
    })
  })
})
