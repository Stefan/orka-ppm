/**
 * Property-Based Tests for Task Continuity Across Devices
 * **Feature: mobile-first-ui-enhancements, Property 35: Task Continuity Across Devices**
 * **Validates: Requirements 11.2**
 */

import fc from 'fast-check'
import { SessionContinuityService, ContinuitySnapshot, TaskContext } from '../lib/sync/session-continuity'

// Mock API functions
const mockApiRequest = jest.fn()
jest.mock('../lib/api', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  getApiUrl: (endpoint: string) => `http://localhost:8001${endpoint}`
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage })

// Mock window properties with proper JSDOM handling
const originalLocation = window.location

beforeAll(() => {
  // Mock location
  delete (window as any).location
  ;(window as any).location = {
    href: 'http://localhost:3000/dashboard',
    pathname: '/dashboard',
    search: '',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn()
  }
  
  // Mock pageYOffset
  Object.defineProperty(window, 'pageYOffset', {
    value: 0,
    writable: true,
    configurable: true
  })
})

afterAll(() => {
  // Restore original location
  ;(window as any).location = originalLocation
})

describe('Task Continuity Across Devices Property Tests', () => {
  let continuityService: SessionContinuityService
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    mockSessionStorage.getItem.mockReturnValue('{}')
    
    // Mock API responses for all endpoints
    mockApiRequest.mockImplementation((endpoint: string, options?: any) => {
      if (endpoint.includes('/sync/continuity/snapshot') && options?.method === 'POST') {
        return Promise.resolve({ success: true })
      }
      if (endpoint.includes('/sync/workspace/')) {
        return Promise.reject(new Error('Not found'))
      }
      return Promise.resolve({})
    })
    
    // Create a fresh instance for each test
    continuityService = new SessionContinuityService()
  })

  afterEach(() => {
    continuityService.cleanup()
  })

  /**
   * Property 35: Task Continuity Across Devices
   * For any task started on one device, users should be able to continue seamlessly on another device
   */
  describe('Property 35: Task Continuity Across Devices', () => {
    // Improved arbitraries for generating test data that avoid problematic strings
    const userIdArb = fc.string({ minLength: 8, maxLength: 20 })
      .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)) // Start with letter, avoid prototype pollution
      .filter(s => !['toString', 'valueOf', 'constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString'].includes(s))
    
    const taskIdArb = fc.string({ minLength: 8, maxLength: 20 })
      .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)) // Start with letter, avoid prototype pollution
      .filter(s => !['toString', 'valueOf', 'constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString'].includes(s))
    
    const taskTypeArb = fc.constantFrom('form', 'workflow', 'analysis', 'report')

    it('should maintain task state consistency', () => {
      fc.assert(fc.property(
        userIdArb,
        taskIdArb,
        taskTypeArb,
        fc.integer({ min: 1, max: 5 }),
        (userId, taskId, taskType, totalSteps) => {
          try {
            // Setup: Initialize continuity service with minimal setup
            continuityService['userId'] = userId // Direct assignment to avoid API calls
            
            // Test: Start a task
            continuityService.startTask(taskId, taskType, totalSteps)
            
            // Update task progress
            continuityService.updateTask(taskId, {
              currentStep: Math.min(2, totalSteps),
              formData: { test: 'data' }
            })
            
            // Get active tasks
            const activeTasks = continuityService.getActiveTasks()
            
            // Verify: Task is tracked correctly
            const task = activeTasks.find(t => t.taskId === taskId)
            
            // Basic property: task exists and maintains its properties
            return task !== undefined &&
                   task.taskType === taskType &&
                   task.totalSteps === totalSteps &&
                   task.currentStep <= totalSteps &&
                   task.lastActivity instanceof Date
          } catch (error) {
            console.error('Test failed:', error)
            return false
          }
        }
      ), { numRuns: 50 })
    })

    it('should handle task completion correctly', () => {
      fc.assert(fc.property(
        userIdArb,
        taskIdArb,
        taskTypeArb,
        fc.integer({ min: 1, max: 3 }),
        (userId, taskId, taskType, totalSteps) => {
          try {
            // Setup: Initialize continuity service
            continuityService['userId'] = userId
            
            // Test: Start and complete a task
            continuityService.startTask(taskId, taskType, totalSteps)
            
            // Verify task is active
            let activeTasks = continuityService.getActiveTasks()
            const taskExistsBefore = activeTasks.some(t => t.taskId === taskId)
            
            // Complete the task
            continuityService.completeTask(taskId)
            
            // Verify task is removed
            activeTasks = continuityService.getActiveTasks()
            const taskExistsAfter = activeTasks.some(t => t.taskId === taskId)
            
            // Property: task exists before completion, doesn't exist after
            return taskExistsBefore === true && taskExistsAfter === false
          } catch (error) {
            console.error('Test failed:', error)
            return false
          }
        }
      ), { numRuns: 50 })
    })

    it('should maintain workspace state consistency', () => {
      fc.assert(fc.property(
        userIdArb,
        fc.constantFrom('grid', 'masonry', 'list'),
        fc.boolean(),
        (userId, layout, sidebarCollapsed) => {
          try {
            // Setup: Initialize continuity service
            continuityService['userId'] = userId
            
            // Mock localStorage operations
            const localData: Record<string, string> = {}
            mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
              localData[key] = value
            })
            
            // Test: Update workspace state
            continuityService.updateWorkspaceState({
              layout,
              sidebarCollapsed,
              activeWidgets: []
            })
            
            // Verify: Workspace state is stored
            const storedData = localData['workspace-state']
            if (!storedData) {
              return false
            }
            
            const parsedData = JSON.parse(storedData)
            
            // Property: stored data matches input
            return parsedData.layout === layout &&
                   parsedData.sidebarCollapsed === sidebarCollapsed &&
                   parsedData.lastModified !== undefined
          } catch (error) {
            console.error('Test failed:', error)
            return false
          }
        }
      ), { numRuns: 50 })
    })

    it('should handle concurrent task updates correctly', () => {
      fc.assert(fc.property(
        userIdArb,
        taskIdArb,
        taskTypeArb,
        fc.integer({ min: 3, max: 5 }),
        (userId, taskId, taskType, totalSteps) => {
          try {
            // Setup: Initialize continuity service
            continuityService['userId'] = userId
            
            // Test: Start a task
            continuityService.startTask(taskId, taskType, totalSteps)
            
            // Apply multiple updates
            for (let i = 1; i <= 3; i++) {
              const validStep = Math.min(i, totalSteps)
              continuityService.updateTask(taskId, {
                currentStep: validStep,
                formData: { step: i, data: `update-${i}` }
              })
            }
            
            // Verify: Task maintains consistency
            const activeTasks = continuityService.getActiveTasks()
            const task = activeTasks.find(t => t.taskId === taskId)
            
            // Property: task exists and maintains valid state
            return task !== undefined &&
                   task.taskType === taskType &&
                   task.totalSteps === totalSteps &&
                   task.currentStep <= totalSteps &&
                   task.currentStep >= 1 &&
                   task.lastActivity instanceof Date
          } catch (error) {
            console.error('Test failed:', error)
            return false
          }
        }
      ), { numRuns: 50 })
    })

    it('should restore basic task state from snapshots', () => {
      fc.assert(fc.asyncProperty(
        userIdArb,
        taskIdArb,
        taskTypeArb,
        fc.integer({ min: 1, max: 3 }),
        async (userId, taskId, taskType, totalSteps) => {
          try {
            // Create a completely fresh service instance for each test
            const testService = new SessionContinuityService()
            testService['userId'] = userId
            
            // Ensure the service starts with no active tasks
            const initialTasks = testService.getActiveTasks()
            if (initialTasks.length !== 0) {
              return false
            }
            
            // Create a simple snapshot with explicit task data
            const testTask: TaskContext = {
              taskId,
              taskType,
              currentStep: 1,
              totalSteps,
              formData: { test: 'data' },
              completedSteps: [],
              context: {},
              startedAt: new Date(),
              lastActivity: new Date(),
              deviceId: 'test-device'
            }
            
            const snapshot: ContinuitySnapshot = {
              id: 'test-snapshot',
              userId,
              deviceId: 'test-device',
              timestamp: new Date(),
              sessionState: {
                userId,
                deviceId: 'test-device',
                currentWorkspace: '/dashboard',
                openTabs: ['/dashboard'],
                activeFilters: {},
                scrollPositions: {},
                formData: {},
                lastActivity: new Date(),
                version: 1
              },
              workspaceState: {
                userId,
                workspaceId: 'default',
                layout: 'grid',
                activeWidgets: [],
                widgetPositions: {},
                sidebarCollapsed: false,
                activeFilters: {},
                sortSettings: {},
                viewSettings: {},
                lastModified: new Date(),
                deviceId: 'test-device'
              },
              activeTasks: [testTask], // Use the explicitly created task
              browserState: {
                url: 'http://localhost:3000/dashboard', // Use valid URL
                scrollPosition: 0,
                formData: {},
                selectedItems: []
              },
              metadata: {
                deviceName: 'Test Device',
                deviceType: 'desktop',
                appVersion: '1.0.0'
              }
            }
            
            // Test: Apply snapshot
            await testService.applySnapshot(snapshot)
            
            // Verify: Active tasks are restored
            const restoredTasks = testService.getActiveTasks()
            
            // Should have exactly one task
            if (restoredTasks.length !== 1) {
              return false
            }
            
            const restoredTask = restoredTasks[0]
            
            // Property: task is restored with correct properties
            const taskIdMatch = restoredTask.taskId === taskId
            const taskTypeMatch = restoredTask.taskType === taskType
            const totalStepsMatch = restoredTask.totalSteps === totalSteps
            
            const isValid = taskIdMatch && taskTypeMatch && totalStepsMatch
            
            // Clean up
            testService.cleanup()
            
            return isValid
          } catch (error) {
            console.error('Test failed:', error)
            return false
          }
        }
      ), { numRuns: 25 })
    })
  })
})

// Integration test for complete task continuity workflow
describe('Task Continuity Integration', () => {
  let continuityService: SessionContinuityService
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    mockSessionStorage.getItem.mockReturnValue('{}')
    
    mockApiRequest.mockImplementation((endpoint: string, options?: any) => {
      if (endpoint.includes('/sync/continuity/snapshot') && options?.method === 'POST') {
        return Promise.resolve({ success: true })
      }
      if (endpoint.includes('/sync/workspace/')) {
        return Promise.reject(new Error('Not found'))
      }
      return Promise.resolve({})
    })
    
    continuityService = new SessionContinuityService()
  })

  afterEach(() => {
    continuityService.cleanup()
  })

  test('Simple snapshot restoration test', async () => {
    const testService = new SessionContinuityService()
    testService['userId'] = 'testUser123'
    
    // Ensure the service starts with no active tasks
    expect(testService.getActiveTasks()).toHaveLength(0)
    
    const testTask: TaskContext = {
      taskId: 'testTask456',
      taskType: 'workflow',
      currentStep: 1,
      totalSteps: 5,
      formData: { test: 'data' },
      completedSteps: [],
      context: {},
      startedAt: new Date(),
      lastActivity: new Date(),
      deviceId: 'test-device'
    }
    
    const snapshot: ContinuitySnapshot = {
      id: 'test-snapshot',
      userId: 'testUser123',
      deviceId: 'test-device',
      timestamp: new Date(),
      sessionState: {
        userId: 'testUser123',
        deviceId: 'test-device',
        currentWorkspace: '/dashboard',
        openTabs: ['/dashboard'],
        activeFilters: {},
        scrollPositions: {},
        formData: {},
        lastActivity: new Date(),
        version: 1
      },
      workspaceState: {
        userId: 'testUser123',
        workspaceId: 'default',
        layout: 'grid',
        activeWidgets: [],
        widgetPositions: {},
        sidebarCollapsed: false,
        activeFilters: {},
        sortSettings: {},
        viewSettings: {},
        lastModified: new Date(),
        deviceId: 'test-device'
      },
      activeTasks: [testTask],
      browserState: {
        url: 'http://localhost:3000/dashboard',
        scrollPosition: 0,
        formData: {},
        selectedItems: []
      },
      metadata: {
        deviceName: 'Test Device',
        deviceType: 'desktop',
        appVersion: '1.0.0'
      }
    }
    
    // Apply snapshot
    await testService.applySnapshot(snapshot)
    
    // Verify restoration
    const restoredTasks = testService.getActiveTasks()
    expect(restoredTasks).toHaveLength(1)
    
    const restoredTask = restoredTasks[0]
    expect(restoredTask.taskId).toBe('testTask456')
    expect(restoredTask.taskType).toBe('workflow')
    expect(restoredTask.totalSteps).toBe(5)
    
    testService.cleanup()
  })
})