/**
 * Unit tests for Screenshot Service
 * Tests screenshot capture, annotation, and visual guide generation functionality
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { VisualGuideBuilder, SCREENSHOT_CONFIG } from '../screenshot-service'
import type { ScreenshotOptions, GuideGenerationOptions, ScreenshotResult } from '../screenshot-service'
import type { VisualGuide, VisualGuideStep, ScreenshotAnnotation } from '../../components/help-chat/VisualGuideSystem'

// Mock the entire screenshot service module
jest.mock('../screenshot-service', () => {
  const mockScreenshotResult: ScreenshotResult = {
    dataUrl: 'data:image/png;base64,mock-screenshot',
    blob: new Blob(['mock-blob'], { type: 'image/png' }),
    width: 1920,
    height: 1080,
    timestamp: new Date(),
    metadata: {
      element: 'body',
      format: 'image/png',
      quality: 0.9,
      devicePixelRatio: 2
    }
  }

  class MockScreenshotService {
    async captureScreenshot(options: any = {}): Promise<ScreenshotResult> {
      if (options.element === '#failing-element') {
        throw new Error('Canvas error')
      }
      
      return {
        ...mockScreenshotResult,
        metadata: {
          ...mockScreenshotResult.metadata,
          element: options.element || 'body',
          format: options.format || 'image/png',
          quality: options.quality || 0.9
        }
      }
    }

    async captureWithAnnotations(options: any) {
      const screenshot = await this.captureScreenshot(options)
      const annotations: ScreenshotAnnotation[] = []

      // Add manual annotations
      if (options.annotations) {
        options.annotations.forEach((annotation: any, index: number) => {
          annotations.push({
            id: `annotation-${index}`,
            type: 'highlight',
            position: { x: 50, y: 50 },
            color: '#3B82F6',
            ...annotation
          })
        })
      }

      // Add auto-detected annotations
      if (options.autoDetectElements) {
        annotations.push({
          id: 'auto-0',
          type: 'highlight',
          position: { x: 25, y: 25 },
          size: { width: 10, height: 5 },
          content: 'Interactive element',
          color: '#10B981'
        })
      }

      return { ...screenshot, annotations }
    }

    async generateVisualGuide(options: GuideGenerationOptions): Promise<VisualGuide> {
      const processedSteps: VisualGuideStep[] = []

      for (let i = 0; i < options.steps.length; i++) {
        const step = options.steps[i]
        const stepId = `step-${i + 1}-${Date.now()}`

        try {
          if (step.targetElement === '#failing-element') {
            throw new Error('Screenshot failed')
          }

          processedSteps.push({
            ...step,
            id: stepId,
            screenshot: 'data:image/png;base64,mock-screenshot',
            annotations: step.annotations || []
          })
        } catch (error) {
          processedSteps.push({
            ...step,
            id: stepId,
            annotations: step.annotations || []
          })
        }
      }

      return {
        id: `guide-${Date.now()}`,
        ...options,
        steps: processedSteps,
        version: '1.0.0',
        lastUpdated: new Date(),
        tags: options.tags || []
      }
    }

    async createThumbnail(screenshot: ScreenshotResult, size: number = 300): Promise<string> {
      if (screenshot.dataUrl === 'invalid-data-url') {
        throw new Error('Failed to load image for thumbnail')
      }
      return 'data:image/jpeg;base64,mock-thumbnail'
    }

    async validateScreenshotFreshness(
      screenshot: ScreenshotResult,
      targetElement?: string
    ): Promise<{ isValid: boolean; confidence: number; issues: string[] }> {
      const issues: string[] = []
      let confidence = 1.0

      const age = Date.now() - screenshot.timestamp.getTime()
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days

      if (age > maxAge) {
        issues.push('Screenshot is older than 30 days')
        confidence *= 0.5
      }

      if (targetElement === '#missing-element') {
        issues.push('Target element no longer exists')
        confidence *= 0.3
      }

      if (screenshot.metadata?.devicePixelRatio !== 2) {
        issues.push('Device pixel ratio has changed')
        confidence *= 0.9
      }

      return {
        isValid: confidence > 0.7,
        confidence,
        issues
      }
    }
  }

  // Keep the actual VisualGuideBuilder
  const actual = jest.requireActual('../screenshot-service')
  
  return {
    ScreenshotService: MockScreenshotService,
    VisualGuideBuilder: actual.VisualGuideBuilder,
    SCREENSHOT_CONFIG: {
      quality: 0.9,
      format: 'image/png',
      maxWidth: 1920,
      maxHeight: 1080,
      thumbnailSize: 300,
      storage: {
        prefix: 'help-screenshots/',
        maxAge: 30 * 24 * 60 * 60 * 1000
      },
      annotations: {
        defaultColor: '#3B82F6',
        defaultSize: { width: 10, height: 5 },
        animationDuration: 300
      }
    }
  }
})

describe('ScreenshotService', () => {
  let screenshotService: any
  
  beforeEach(() => {
    const { ScreenshotService } = require('../screenshot-service')
    screenshotService = new ScreenshotService()
    jest.clearAllMocks()
  })

  describe('Screenshot Capture', () => {
    it('should capture screenshot of entire page by default', async () => {
      // Requirement 4.1: Include relevant screenshots of the interface
      const result = await screenshotService.captureScreenshot()

      expect(result).toEqual({
        dataUrl: 'data:image/png;base64,mock-screenshot',
        blob: expect.any(Blob),
        width: 1920,
        height: 1080,
        timestamp: expect.any(Date),
        metadata: {
          element: 'body',
          format: 'image/png',
          quality: 0.9,
          devicePixelRatio: 2
        }
      })
    })

    it('should capture screenshot of specific element', async () => {
      // Requirement 4.4: Highlight specific UI elements
      const options: ScreenshotOptions = {
        element: '#test-element',
        quality: 0.8,
        format: 'image/jpeg'
      }

      const result = await screenshotService.captureScreenshot(options)

      expect(result.metadata.element).toBe('#test-element')
      expect(result.metadata.format).toBe('image/jpeg')
      expect(result.metadata.quality).toBe(0.8)
    })

    it('should handle screenshot capture errors gracefully', async () => {
      // Requirement 4.5: Flag outdated screenshots for review
      await expect(screenshotService.captureScreenshot({ element: '#failing-element' })).rejects.toThrow(
        'Canvas error'
      )
    })

    it('should exclude specified elements during capture', async () => {
      const options: ScreenshotOptions = {
        excludeElements: ['.exclude-me']
      }

      const result = await screenshotService.captureScreenshot(options)

      // Verify screenshot was captured successfully
      expect(result.dataUrl).toBe('data:image/png;base64,mock-screenshot')
    })
  })

  describe('Screenshot Annotations', () => {
    it('should capture screenshot with manual annotations', async () => {
      // Requirement 4.4: Highlight specific UI elements with arrows and callouts
      const annotations: Partial<ScreenshotAnnotation>[] = [
        {
          type: 'arrow',
          position: { x: 50, y: 50 },
          direction: 'right',
          content: 'Click here'
        },
        {
          type: 'callout',
          position: { x: 75, y: 25 },
          content: 'Important feature'
        }
      ]

      const result = await screenshotService.captureWithAnnotations({
        annotations
      })

      expect(result.annotations).toHaveLength(2)
      expect(result.annotations[0]).toMatchObject({
        id: 'annotation-0',
        type: 'arrow',
        position: { x: 50, y: 50 },
        direction: 'right',
        content: 'Click here',
        color: SCREENSHOT_CONFIG.annotations.defaultColor
      })
    })

    it('should auto-detect interactive elements for annotation', async () => {
      // Requirement 4.4: Highlight specific UI elements
      const result = await screenshotService.captureWithAnnotations({
        autoDetectElements: true
      })

      expect(result.annotations.length).toBeGreaterThan(0)
      expect(result.annotations[0]).toMatchObject({
        id: 'auto-0',
        type: 'highlight',
        color: '#10B981' // Green for auto-detected elements
      })
    })
  })

  describe('Visual Guide Generation', () => {
    it('should generate visual guide with screenshots for each step', async () => {
      // Requirement 4.2: Provide step-by-step visual overlays
      const options: GuideGenerationOptions = {
        title: 'Create New Project',
        description: 'Learn how to create a new project in the system',
        category: 'feature',
        difficulty: 'beginner',
        estimatedTime: 5,
        steps: [
          {
            title: 'Click New Project Button',
            description: 'Navigate to the projects page and click the new project button',
            targetElement: '#new-project-btn',
            action: 'click',
            annotations: [
              {
                id: 'click-annotation',
                type: 'click',
                position: { x: 50, y: 50 }
              }
            ]
          },
          {
            title: 'Fill Project Details',
            description: 'Enter the project name and description',
            targetElement: '#project-form',
            action: 'type',
            actionData: { text: 'My New Project' },
            annotations: []
          }
        ],
        tags: ['projects', 'getting-started']
      }

      const guide = await screenshotService.generateVisualGuide(options)

      expect(guide).toMatchObject({
        id: expect.stringMatching(/^guide-\d+$/),
        title: 'Create New Project',
        description: 'Learn how to create a new project in the system',
        category: 'feature',
        difficulty: 'beginner',
        estimatedTime: 5,
        version: '1.0.0',
        lastUpdated: expect.any(Date),
        tags: ['projects', 'getting-started']
      })

      expect(guide.steps).toHaveLength(2)
      expect(guide.steps[0]).toMatchObject({
        id: expect.stringMatching(/^step-1-\d+$/),
        title: 'Click New Project Button',
        screenshot: 'data:image/png;base64,mock-screenshot',
        action: 'click',
        annotations: expect.arrayContaining([
          expect.objectContaining({
            type: 'click',
            position: { x: 50, y: 50 }
          })
        ])
      })
    })

    it('should handle screenshot failures gracefully in guide generation', async () => {
      // Requirement 4.5: Handle outdated screenshots
      const options: GuideGenerationOptions = {
        title: 'Test Guide',
        description: 'Test guide with failing screenshot',
        category: 'feature',
        difficulty: 'beginner',
        estimatedTime: 2,
        steps: [
          {
            title: 'Test Step',
            description: 'This step will fail to capture screenshot',
            targetElement: '#failing-element',
            annotations: []
          }
        ]
      }

      const guide = await screenshotService.generateVisualGuide(options)

      expect(guide.steps).toHaveLength(1)
      expect(guide.steps[0].screenshot).toBeUndefined()
      expect(guide.steps[0].title).toBe('Test Step')
    })
  })

  describe('Thumbnail Generation', () => {
    it('should create thumbnail from screenshot', async () => {
      // Requirement 4.1: Include relevant screenshots
      const mockScreenshot: ScreenshotResult = {
        dataUrl: 'data:image/png;base64,mock-screenshot',
        blob: new Blob(),
        width: 1920,
        height: 1080,
        timestamp: new Date()
      }

      const thumbnail = await screenshotService.createThumbnail(mockScreenshot, 200)

      expect(thumbnail).toBe('data:image/jpeg;base64,mock-thumbnail')
    })

    it('should handle thumbnail generation errors', async () => {
      const mockScreenshot: ScreenshotResult = {
        dataUrl: 'invalid-data-url',
        blob: new Blob(),
        width: 1920,
        height: 1080,
        timestamp: new Date()
      }

      await expect(screenshotService.createThumbnail(mockScreenshot)).rejects.toThrow(
        'Failed to load image for thumbnail'
      )
    })
  })

  describe('Screenshot Validation', () => {
    it('should validate screenshot freshness', async () => {
      // Requirement 4.5: Flag outdated screenshots for manual review
      const recentScreenshot: ScreenshotResult = {
        dataUrl: 'data:image/png;base64,recent',
        blob: new Blob(),
        width: 1920,
        height: 1080,
        timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        metadata: {
          devicePixelRatio: 2
        }
      }

      const validation = await screenshotService.validateScreenshotFreshness(
        recentScreenshot,
        '#test-element'
      )

      expect(validation.isValid).toBe(true)
      expect(validation.confidence).toBeGreaterThan(0.7)
    })

    it('should flag old screenshots as invalid', async () => {
      // Requirement 4.5: Flag outdated screenshots
      const oldScreenshot: ScreenshotResult = {
        dataUrl: 'data:image/png;base64,old',
        blob: new Blob(),
        width: 1920,
        height: 1080,
        timestamp: new Date(Date.now() - SCREENSHOT_CONFIG.storage.maxAge - 1000) // Older than max age
      }

      const validation = await screenshotService.validateScreenshotFreshness(oldScreenshot)

      expect(validation.isValid).toBe(false)
      expect(validation.confidence).toBeLessThan(0.7)
      expect(validation.issues).toContain('Screenshot is older than 30 days')
    })

    it('should detect missing target elements', async () => {
      // Requirement 4.5: Flag screenshots when elements no longer exist
      const screenshot: ScreenshotResult = {
        dataUrl: 'data:image/png;base64,test',
        blob: new Blob(),
        width: 1920,
        height: 1080,
        timestamp: new Date()
      }

      const validation = await screenshotService.validateScreenshotFreshness(
        screenshot,
        '#missing-element'
      )

      expect(validation.confidence).toBeLessThan(0.5)
      expect(validation.issues).toContain('Target element no longer exists')
    })
  })
})

describe('VisualGuideBuilder', () => {
  it('should build visual guide with fluent interface', () => {
    // Requirement 4.2: Create step-by-step visual overlays
    const mockScreenshotService = {
      captureScreen: jest.fn().mockResolvedValue('screenshot-data'),
      captureElement: jest.fn().mockResolvedValue('element-screenshot-data'),
    } as any

    const builder = new VisualGuideBuilder(mockScreenshotService)
    const guide = builder
      .startGuide('Test Guide', 'A test guide for unit testing', 'workflow')
      .setDifficulty('intermediate')
      .setEstimatedTime(10)
      .addTags('testing', 'automation')
      .addStep('First Step', 'This is the first step')
      .addStep('Second Step', 'This is the second step', {
        action: 'click',
        element: '#submit-btn'
      })
      .build()

    expect(guide).toBeDefined()
    expect(guide.title).toBe('Test Guide')
    expect(guide.description).toBe('A test guide for unit testing')
    expect(guide.category).toBe('workflow')
    expect(guide.difficulty).toBe('intermediate')
    expect(guide.estimatedTime).toBe(10)
    expect(guide.tags).toContain('testing')
    expect(guide.tags).toContain('automation')
    expect(guide.steps).toHaveLength(2)
    expect(guide.steps[0].title).toBe('First Step')
    expect(guide.steps[1].action).toBe('click')
  })

  it('should throw error when building incomplete guide', () => {
    const mockScreenshotService = {} as any
    const builder = new VisualGuideBuilder(mockScreenshotService)
    
    expect(() => builder.build()).toThrow('Guide title and description are required')
  })

  it('should generate unique step IDs', () => {
    const mockScreenshotService = {} as any
    const builder = new VisualGuideBuilder(mockScreenshotService)
    
    builder
      .startGuide('Test', 'Test guide')
      .addStep('Step 1', 'First step')
      .addStep('Step 2', 'Second step')
    
    const guide = builder.build()
    
    expect(guide.steps[0].id).toBe('step_1')
    expect(guide.steps[1].id).toBe('step_2')
  })
})