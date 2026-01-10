/**
 * Screenshot Service
 * Provides screenshot capture and visual guide generation functionality
 */

import type { ScreenshotAnnotation, VisualGuide, VisualGuideStep } from '../../components/help-chat/VisualGuideSystem'

// Configuration
const SCREENSHOT_CONFIG = {
  quality: 0.9,
  format: 'image/png' as const,
  maxWidth: 1920,
  maxHeight: 1080,
  thumbnailSize: 300,
  storage: {
    prefix: 'help-screenshots/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  annotations: {
    defaultColor: '#3B82F6',
    defaultSize: { width: 10, height: 5 },
    animationDuration: 300
  }
} as const

// Types
export interface ScreenshotOptions {
  element?: HTMLElement | string
  quality?: number
  format?: 'image/png' | 'image/jpeg' | 'image/webp'
  width?: number
  height?: number
  excludeElements?: string[]
  includeBackground?: boolean
}

export interface ScreenshotResult {
  dataUrl: string
  blob: Blob
  width: number
  height: number
  timestamp: Date
  metadata?: Record<string, any>
}

export interface GuideGenerationOptions {
  title: string
  description: string
  category: 'feature' | 'workflow' | 'troubleshooting' | 'onboarding'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: number
  steps: Omit<VisualGuideStep, 'id' | 'screenshot'>[]
  tags?: string[]
  prerequisites?: string[]
}

/**
 * Screenshot Service Class
 * Handles screenshot capture, annotation, and visual guide generation
 */
export class ScreenshotService {
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null

  constructor() {
    // Initialize canvas for image processing
    if (typeof window !== 'undefined') {
      this.canvas = document.createElement('canvas')
      this.context = this.canvas.getContext('2d')
    }
  }

  /**
   * Capture screenshot of entire page or specific element
   */
  async captureScreenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const {
      element,
      quality = SCREENSHOT_CONFIG.quality,
      format = SCREENSHOT_CONFIG.format,
      width,
      height,
      excludeElements = [],
      includeBackground = true
    } = options

    try {
      // Get target element
      const targetElement = this.getTargetElement(element)
      
      // Hide excluded elements temporarily
      const hiddenElements = this.hideElements(excludeElements)

      // Use html2canvas for screenshot capture
      const html2canvas = await this.loadHtml2Canvas()
      
      const canvas = await html2canvas(targetElement, {
        allowTaint: true,
        useCORS: true,
        scale: window.devicePixelRatio || 1,
        width: width || targetElement.scrollWidth,
        height: height || targetElement.scrollHeight,
        backgroundColor: includeBackground ? '#ffffff' : null,
        removeContainer: true,
        imageTimeout: 15000,
        logging: false
      })

      // Restore hidden elements
      this.restoreElements(hiddenElements)

      // Convert to desired format
      const dataUrl = canvas.toDataURL(format, quality)
      const blob = await this.dataUrlToBlob(dataUrl)

      return {
        dataUrl,
        blob,
        width: canvas.width,
        height: canvas.height,
        timestamp: new Date(),
        metadata: {
          element: element ? this.getElementSelector(targetElement) : 'body',
          format,
          quality,
          devicePixelRatio: window.devicePixelRatio || 1
        }
      }
    } catch (error) {
      console.error('Screenshot capture failed:', error)
      throw new Error(`Failed to capture screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Capture screenshot with automatic annotations
   */
  async captureWithAnnotations(
    options: ScreenshotOptions & {
      annotations?: Partial<ScreenshotAnnotation>[]
      autoDetectElements?: boolean
    }
  ): Promise<ScreenshotResult & { annotations: ScreenshotAnnotation[] }> {
    const { annotations = [], autoDetectElements = false, ...screenshotOptions } = options

    // Capture base screenshot
    const screenshot = await this.captureScreenshot(screenshotOptions)

    // Generate annotations
    let finalAnnotations: ScreenshotAnnotation[] = []

    // Add manual annotations
    finalAnnotations = annotations.map((annotation, index) => ({
      id: `annotation-${index}`,
      type: 'highlight',
      position: { x: 50, y: 50 },
      color: SCREENSHOT_CONFIG.annotations.defaultColor,
      ...annotation
    })) as ScreenshotAnnotation[]

    // Auto-detect interactive elements if requested
    if (autoDetectElements) {
      const autoAnnotations = await this.autoDetectElements(
        this.getTargetElement(screenshotOptions.element)
      )
      finalAnnotations = [...finalAnnotations, ...autoAnnotations]
    }

    return {
      ...screenshot,
      annotations: finalAnnotations
    }
  }

  /**
   * Generate visual guide from steps
   */
  async generateVisualGuide(
    options: GuideGenerationOptions,
    screenshotOptions: ScreenshotOptions = {}
  ): Promise<VisualGuide> {
    const { steps, ...guideOptions } = options

    // Generate screenshots for each step
    const processedSteps: VisualGuideStep[] = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      
      try {
        // Capture screenshot for this step
        const screenshot = await this.captureScreenshot({
          ...screenshotOptions,
          element: step.targetElement
        })

        // Generate step ID
        const stepId = `step-${i + 1}-${Date.now()}`

        // Process annotations
        const annotations = step.annotations || []

        processedSteps.push({
          ...step,
          id: stepId,
          screenshot: screenshot.dataUrl,
          annotations
        })

        // Small delay between screenshots to allow for UI changes
        await this.delay(500)
      } catch (error) {
        console.warn(`Failed to capture screenshot for step ${i + 1}:`, error)
        
        // Add step without screenshot
        processedSteps.push({
          ...step,
          id: `step-${i + 1}-${Date.now()}`,
          annotations: step.annotations || []
        })
      }
    }

    return {
      id: `guide-${Date.now()}`,
      ...guideOptions,
      steps: processedSteps,
      version: '1.0.0',
      lastUpdated: new Date(),
      tags: guideOptions.tags || []
    }
  }

  /**
   * Create thumbnail from screenshot
   */
  async createThumbnail(
    screenshot: ScreenshotResult,
    size: number = SCREENSHOT_CONFIG.thumbnailSize
  ): Promise<string> {
    if (!this.canvas || !this.context) {
      throw new Error('Canvas not available')
    }

    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        // Calculate thumbnail dimensions
        const aspectRatio = img.width / img.height
        let thumbWidth = size
        let thumbHeight = size

        if (aspectRatio > 1) {
          thumbHeight = size / aspectRatio
        } else {
          thumbWidth = size * aspectRatio
        }

        // Set canvas size
        this.canvas!.width = thumbWidth
        this.canvas!.height = thumbHeight

        // Draw thumbnail
        this.context!.drawImage(img, 0, 0, thumbWidth, thumbHeight)

        // Convert to data URL
        resolve(this.canvas!.toDataURL('image/jpeg', 0.8))
      }

      img.onerror = () => reject(new Error('Failed to load image for thumbnail'))
      img.src = screenshot.dataUrl
    })
  }

  /**
   * Validate screenshot freshness
   */
  async validateScreenshotFreshness(
    screenshot: ScreenshotResult,
    targetElement?: HTMLElement | string
  ): Promise<{ isValid: boolean; confidence: number; issues: string[] }> {
    const issues: string[] = []
    let confidence = 1.0

    // Check age
    const age = Date.now() - screenshot.timestamp.getTime()
    const maxAge = SCREENSHOT_CONFIG.storage.maxAge

    if (age > maxAge) {
      issues.push('Screenshot is older than 30 days')
      confidence *= 0.5
    } else if (age > maxAge / 2) {
      issues.push('Screenshot is getting old')
      confidence *= 0.8
    }

    // Check if target element still exists
    if (targetElement) {
      const element = this.getTargetElement(targetElement)
      if (!element || !document.contains(element)) {
        issues.push('Target element no longer exists')
        confidence *= 0.3
      }
    }

    // Check viewport size changes
    if (screenshot.metadata?.devicePixelRatio !== window.devicePixelRatio) {
      issues.push('Device pixel ratio has changed')
      confidence *= 0.9
    }

    return {
      isValid: confidence > 0.7,
      confidence,
      issues
    }
  }

  /**
   * Auto-detect interactive elements for annotation
   */
  private async autoDetectElements(container: HTMLElement): Promise<ScreenshotAnnotation[]> {
    const annotations: ScreenshotAnnotation[] = []
    
    // Find interactive elements
    const interactiveSelectors = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[onclick]',
      '.btn',
      '.button'
    ]

    const elements = container.querySelectorAll(interactiveSelectors.join(', '))
    
    elements.forEach((element, index) => {
      const rect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Calculate relative position
      const x = ((rect.left - containerRect.left + rect.width / 2) / containerRect.width) * 100
      const y = ((rect.top - containerRect.top + rect.height / 2) / containerRect.height) * 100

      // Skip elements outside the container
      if (x < 0 || x > 100 || y < 0 || y > 100) return

      annotations.push({
        id: `auto-${index}`,
        type: 'highlight',
        position: { x, y },
        size: {
          width: (rect.width / containerRect.width) * 100,
          height: (rect.height / containerRect.height) * 100
        },
        content: element.getAttribute('aria-label') || element.textContent?.trim() || 'Interactive element',
        color: '#10B981' // Green for auto-detected elements
      })
    })

    return annotations
  }

  /**
   * Get target element from selector or element
   */
  private getTargetElement(element?: HTMLElement | string): HTMLElement {
    if (!element) {
      return document.body
    }

    if (typeof element === 'string') {
      const found = document.querySelector(element) as HTMLElement
      if (!found) {
        throw new Error(`Element not found: ${element}`)
      }
      return found
    }

    return element
  }

  /**
   * Get CSS selector for element
   */
  private getElementSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`
    }

    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim())
      if (classes.length > 0) {
        return `.${classes.join('.')}`
      }
    }

    return element.tagName.toLowerCase()
  }

  /**
   * Hide elements temporarily
   */
  private hideElements(selectors: string[]): Array<{ element: HTMLElement; originalStyle: string }> {
    const hiddenElements: Array<{ element: HTMLElement; originalStyle: string }> = []

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(element => {
        const htmlElement = element as HTMLElement
        hiddenElements.push({
          element: htmlElement,
          originalStyle: htmlElement.style.display
        })
        htmlElement.style.display = 'none'
      })
    })

    return hiddenElements
  }

  /**
   * Restore hidden elements
   */
  private restoreElements(hiddenElements: Array<{ element: HTMLElement; originalStyle: string }>): void {
    hiddenElements.forEach(({ element, originalStyle }) => {
      element.style.display = originalStyle
    })
  }

  /**
   * Convert data URL to blob
   */
  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl)
    return response.blob()
  }

  /**
   * Load html2canvas library dynamically
   */
  private async loadHtml2Canvas(): Promise<any> {
    // In a real implementation, you would dynamically import html2canvas
    // For now, we'll assume it's available globally or imported
    if (typeof window !== 'undefined' && (window as any).html2canvas) {
      return (window as any).html2canvas
    }

    // Fallback: try to import dynamically
    try {
      const html2canvas = await import('html2canvas')
      return html2canvas.default
    } catch (error) {
      throw new Error('html2canvas library not available. Please install it: npm install html2canvas')
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => resolve(), ms)
    })
  }
}

/**
 * Visual Guide Builder
 * Helper class for building visual guides step by step
 */
export class VisualGuideBuilder {
  private guide: Partial<VisualGuide> = {
    steps: [],
    tags: [],
    version: '1.0.0'
  }

  constructor(title: string, description: string) {
    this.guide.title = title
    this.guide.description = description
    this.guide.id = `guide-${Date.now()}`
    this.guide.lastUpdated = new Date()
  }

  setCategory(category: VisualGuide['category']): this {
    this.guide.category = category
    return this
  }

  setDifficulty(difficulty: VisualGuide['difficulty']): this {
    this.guide.difficulty = difficulty
    return this
  }

  setEstimatedTime(minutes: number): this {
    this.guide.estimatedTime = minutes
    return this
  }

  addTag(tag: string): this {
    if (!this.guide.tags) this.guide.tags = []
    this.guide.tags.push(tag)
    return this
  }

  addPrerequisite(prerequisite: string): this {
    if (!this.guide.prerequisites) this.guide.prerequisites = []
    this.guide.prerequisites.push(prerequisite)
    return this
  }

  addStep(step: Omit<VisualGuideStep, 'id'>): this {
    if (!this.guide.steps) this.guide.steps = []
    
    this.guide.steps.push({
      ...step,
      id: `step-${this.guide.steps.length + 1}-${Date.now()}`
    })
    return this
  }

  addClickStep(
    title: string,
    description: string,
    targetElement: string,
    annotations: ScreenshotAnnotation[] = []
  ): this {
    return this.addStep({
      title,
      description,
      targetElement,
      action: 'click',
      annotations: [
        ...annotations,
        {
          id: `click-${Date.now()}`,
          type: 'click',
          position: { x: 50, y: 50 }, // Will be updated when screenshot is taken
          color: '#EF4444'
        }
      ]
    })
  }

  addTypeStep(
    title: string,
    description: string,
    targetElement: string,
    text: string,
    annotations: ScreenshotAnnotation[] = []
  ): this {
    return this.addStep({
      title,
      description,
      targetElement,
      action: 'type',
      actionData: { text },
      annotations
    })
  }

  build(): VisualGuide {
    if (!this.guide.title || !this.guide.description) {
      throw new Error('Title and description are required')
    }

    if (!this.guide.steps || this.guide.steps.length === 0) {
      throw new Error('At least one step is required')
    }

    return this.guide as VisualGuide
  }
}

// Singleton instance
export const screenshotService = new ScreenshotService()

// Export utility functions
export { SCREENSHOT_CONFIG }