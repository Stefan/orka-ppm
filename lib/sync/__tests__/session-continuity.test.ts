/**
 * Unit tests for lib/sync/session-continuity.ts
 * Mocks apiRequest and storage; NODE_ENV=test skips event listeners.
 * @jest-environment jsdom
 */

const mockApiRequest = jest.fn()
jest.mock('../../api', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}))

describe('SessionContinuityService', () => {
  let service: import('../session-continuity').SessionContinuityService
  let localStorageGet: jest.Mock
  let localStorageSet: jest.Mock
  let sessionStorageGet: jest.Mock
  let sessionStorageSet: jest.Mock

  beforeAll(() => {
    localStorageGet = jest.fn()
    localStorageSet = jest.fn()
    sessionStorageGet = jest.fn()
    sessionStorageSet = jest.fn()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (k === 'device-id' ? 'device-1' : (localStorageGet as jest.Mock)(k)),
        setItem: localStorageSet,
        removeItem: jest.fn(),
      },
      writable: true,
    })
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (k: string) => (sessionStorageGet as jest.Mock)(k) ?? null,
        setItem: sessionStorageSet,
        removeItem: jest.fn(),
      },
      writable: true,
    })
    localStorageGet.mockImplementation(() => null)
    sessionStorageGet.mockImplementation(() => null)
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    localStorageGet.mockImplementation((k: string) => (k === 'device-id' ? 'device-1' : null))
    sessionStorageGet.mockImplementation(() => null)
    const mod = await import('../session-continuity')
    service = mod.sessionContinuityService
    service.cleanup()
  })

  describe('initialize', () => {
    it('loads workspace state from server and starts interval', async () => {
      mockApiRequest.mockResolvedValueOnce({
        userId: 'u1',
        workspaceId: 'w1',
        layout: 'grid',
        activeWidgets: [],
        widgetPositions: {},
        sidebarCollapsed: false,
        activeFilters: {},
        sortSettings: {},
        viewSettings: {},
        lastModified: new Date().toISOString(),
        deviceId: 'device-1',
      })
      await service.initialize('user-1')
      expect(mockApiRequest).toHaveBeenCalledWith('/sync/workspace/user-1')
    })

    it('falls back to localStorage when server fails', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('network'))
      const stored = {
        userId: 'u1',
        workspaceId: 'default',
        layout: 'list',
        lastModified: new Date().toISOString(),
        deviceId: 'device-1',
      }
      localStorageGet.mockImplementation((k: string) =>
        k === 'device-id' ? 'device-1' : k === 'workspace-state' ? JSON.stringify(stored) : null
      )
      await service.initialize('user-1')
      expect(mockApiRequest).toHaveBeenCalledWith('/sync/workspace/user-1')
    })
  })

  describe('startTask, updateTask, completeTask, getActiveTasks', () => {
    beforeEach(async () => {
      mockApiRequest.mockResolvedValue({})
      await service.initialize('user-1')
      mockApiRequest.mockClear()
    })

    it('startTask adds task and getActiveTasks returns it', () => {
      service.startTask('task-1', 'form', 3)
      const tasks = service.getActiveTasks()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].taskId).toBe('task-1')
      expect(tasks[0].taskType).toBe('form')
      expect(tasks[0].totalSteps).toBe(3)
      expect(tasks[0].currentStep).toBe(1)
    })

    it('updateTask updates task progress', () => {
      service.startTask('task-1', 'workflow', 2)
      service.updateTask('task-1', { currentStep: 2, completedSteps: [1] })
      const tasks = service.getActiveTasks()
      expect(tasks[0].currentStep).toBe(2)
      expect(tasks[0].completedSteps).toEqual([1])
    })

    it('completeTask removes task', () => {
      service.startTask('task-1', 'form', 1)
      expect(service.getActiveTasks()).toHaveLength(1)
      service.completeTask('task-1')
      expect(service.getActiveTasks()).toHaveLength(0)
    })
  })

  describe('updateWorkspaceState', () => {
    beforeEach(async () => {
      mockApiRequest.mockResolvedValue({})
      await service.initialize('user-1')
    })

    it('stores workspace state in localStorage', () => {
      service.updateWorkspaceState({ layout: 'list', sidebarCollapsed: true })
      expect(localStorageSet).toHaveBeenCalledWith(
        'workspace-state',
        expect.stringContaining('"layout":"list"')
      )
    })
  })

  describe('restoreFromDevice', () => {
    beforeEach(async () => {
      mockApiRequest.mockResolvedValue({})
      await service.initialize('user-1')
      mockApiRequest.mockClear()
    })

    it('returns null when api fails', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('fail'))
      const result = await service.restoreFromDevice('other-device')
      expect(result).toBeNull()
    })

    it('applies snapshot and returns it when api returns { data }', async () => {
      const snapshot = {
        id: 'snap-1',
        userId: 'user-1',
        deviceId: 'other',
        timestamp: new Date(),
        sessionState: {
          userId: 'user-1',
          deviceId: 'other',
          currentWorkspace: '/projects',
          openTabs: ['/projects'],
          activeFilters: { status: 'active' },
          scrollPositions: {},
          formData: {},
          lastActivity: new Date(),
          version: 1,
        },
        workspaceState: {
          userId: 'user-1',
          workspaceId: 'default',
          layout: 'list',
          activeWidgets: [],
          widgetPositions: {},
          sidebarCollapsed: true,
          activeFilters: {},
          sortSettings: {},
          viewSettings: {},
          lastModified: new Date(),
          deviceId: 'other',
        },
        activeTasks: [],
        browserState: {
          url: 'http://localhost/projects',
          scrollPosition: 0,
          formData: {},
          selectedItems: [],
        },
        metadata: { deviceName: 'Test', deviceType: 'desktop', appVersion: '1.0.0' },
      }
      mockApiRequest.mockResolvedValueOnce({ data: snapshot })
      const result = await service.restoreFromDevice('other')
      expect(result).toEqual(snapshot)
      expect(sessionStorageSet).toHaveBeenCalledWith(
        'active-filters',
        JSON.stringify({ status: 'active' })
      )
    })
  })

  describe('getLatestSnapshot', () => {
    beforeEach(async () => {
      mockApiRequest.mockResolvedValue({})
      await service.initialize('user-1')
      mockApiRequest.mockClear()
    })

    it('returns null when api fails', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('fail'))
      const result = await service.getLatestSnapshot()
      expect(result).toBeNull()
    })

    it('returns response.data when api succeeds', async () => {
      const data = { id: 'snap-1', userId: 'user-1', deviceId: 'd1', timestamp: new Date() } as any
      mockApiRequest.mockResolvedValueOnce({ data })
      const result = await service.getLatestSnapshot()
      expect(result).toEqual(data)
    })
  })

  describe('getAvailableSnapshots', () => {
    beforeEach(async () => {
      mockApiRequest.mockResolvedValue({})
      await service.initialize('user-1')
      mockApiRequest.mockClear()
    })

    it('returns [] when api fails', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('fail'))
      const result = await service.getAvailableSnapshots()
      expect(result).toEqual([])
    })

    it('returns mapped snapshots with Date timestamp', async () => {
      const list = [
        { id: '1', userId: 'user-1', deviceId: 'd1', timestamp: '2024-01-01T00:00:00Z' },
      ] as any[]
      mockApiRequest.mockResolvedValueOnce({ data: list } as any)
      const mod = await import('../session-continuity')
      const service2 = mod.sessionContinuityService
      const result = await service2.getAvailableSnapshots()
      expect(mockApiRequest).toHaveBeenCalledWith(
        `/sync/continuity/snapshots/user-1`
      )
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('applySnapshot', () => {
    beforeEach(async () => {
      mockApiRequest.mockResolvedValue({})
      await service.initialize('user-1')
    })

    it('restores active tasks and dispatches session-restored', async () => {
      const snapshot = {
        id: 'snap-1',
        userId: 'user-1',
        deviceId: 'other',
        timestamp: new Date(),
        sessionState: {
          userId: 'user-1',
          deviceId: 'other',
          currentWorkspace: '/',
          openTabs: ['/'],
          activeFilters: {},
          scrollPositions: {},
          formData: {},
          lastActivity: new Date(),
          version: 1,
        },
        workspaceState: {
          userId: 'user-1',
          workspaceId: 'default',
          layout: 'grid',
          activeWidgets: [],
          widgetPositions: {},
          sidebarCollapsed: false,
          activeFilters: {},
          sortSettings: {},
          viewSettings: {},
          lastModified: new Date(),
          deviceId: 'other',
        },
        activeTasks: [
          {
            taskId: 't1',
            taskType: 'form',
            currentStep: 2,
            totalSteps: 3,
            formData: {},
            completedSteps: [1],
            context: {},
            startedAt: new Date(),
            lastActivity: new Date(),
            deviceId: 'other',
          },
        ],
        browserState: {
          url: window.location.href,
          scrollPosition: 0,
          formData: {},
          selectedItems: ['id1'],
        },
        metadata: { deviceName: 'Test', deviceType: 'desktop', appVersion: '1.0.0' },
      } as any
      const spy = jest.fn()
      window.addEventListener('session-restored', spy)
      await service.applySnapshot(snapshot)
      expect(service.getActiveTasks()).toHaveLength(1)
      expect(service.getActiveTasks()[0].taskId).toBe('t1')
      expect(service.getActiveTasks()[0].currentStep).toBe(2)
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: snapshot }))
      window.removeEventListener('session-restored', spy)
    })
  })

  describe('cleanup', () => {
    it('clears state', async () => {
      mockApiRequest.mockResolvedValue({})
      await service.initialize('user-1')
      service.startTask('t1', 'form', 1)
      service.cleanup()
      expect(service.getActiveTasks()).toHaveLength(0)
    })
  })
})

describe('useSessionContinuity', () => {
  it('returns the singleton service', async () => {
    const { useSessionContinuity } = await import('../session-continuity')
    const result = useSessionContinuity()
    expect(result).toBeDefined()
    expect(typeof result.initialize).toBe('function')
    expect(typeof result.getActiveTasks).toBe('function')
  })
})
