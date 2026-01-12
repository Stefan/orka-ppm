/**
 * Screenshot Service
 * Handles screenshot capture and visual guide creation
 */

export interface ScreenshotResult {
  dataUrl: string
  blob: Blob
  width: number
  height: number
  timestamp: Date
}

export interface VisualGuideStep {
  id: string
  title: string
  description: string
  screenshot?: ScreenshotResult
  element?: string
  action?: 'click' | 'type' | 'hover' | 'scroll' | 'wait'
  coordinates?: { x: number; y: number }
  text?: string
  duration?: number
}

export interface VisualGuide {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: number
  steps: VisualGuideStep[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
  author?: string
  version: string
}

export class ScreenshotService {
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.canvas = document.createElement('canvas')
      this.context = this.canvas.getContext('2d')
    }
  }

  async captureScreen(): Promise<ScreenshotResult> {
    if (typeof window === 'undefined') {
      throw new Error('Screenshot capture is only available in browser environment')
    }

    try {
      // Use the Screen Capture API if available
      if ('getDisplayMedia' in navigator.mediaDevices) {
        return await this.captureWithDisplayMedia()
      }

      // Fallback to html2canvas if available
      if (typeof window !== 'undefined' && (window as any).html2canvas) {
        return await this.captureWithHtml2Canvas()
      }

      throw new Error('No screenshot capture method available')
    } catch (error) {
      console.error('Screenshot capture failed:', error)
      throw error
    }
  }

  private async captureWithDisplayMedia(): Promise<ScreenshotResult> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    })

    const video = document.createElement('video')
    video.srcObject = stream
    video.play()

    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        if (!this.canvas || !this.context) {
          reject(new Error('Canvas not available'))
          return
        }

        this.canvas.width = video.videoWidth
        this.canvas.height = video.videoHeight
        this.context.drawImage(video, 0, 0)

        // Stop the stream
        stream.getTracks().forEach(track => track.stop())

        this.canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'))
            return
          }

          resolve({
            dataUrl: this.canvas!.toDataURL(),
            blob,
            width: this.canvas!.width,
            height: this.canvas!.height,
            timestamp: new Date()
          })
        })
      }

      video.onerror = reject
    })
  }

  private async captureWithHtml2Canvas(): Promise<ScreenshotResult> {
    const html2canvas = (window as any).html2canvas

    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      scale: 1
    })

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          reject(new Error('Failed to create blob'))
          return
        }

        resolve({
          dataUrl: canvas.toDataURL(),
          blob,
          width: canvas.width,
          height: canvas.height,
          timestamp: new Date()
        })
      })
    })
  }

  async captureElement(selector: string): Promise<ScreenshotResult> {
    if (typeof window === 'undefined') {
      throw new Error('Element capture is only available in browser environment')
    }

    const element = document.querySelector(selector)
    if (!element) {
      throw new Error(`Element not found: ${selector}`)
    }

    if (typeof window !== 'undefined' && (window as any).html2canvas) {
      const html2canvas = (window as any).html2canvas
      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        scale: 1
      })

      return new Promise((resolve, reject) => {
        canvas.toBlob((blob: Blob | null) => {
          if (!blob) {
            reject(new Error('Failed to create blob'))
            return
          }

          resolve({
            dataUrl: canvas.toDataURL(),
            blob,
            width: canvas.width,
            height: canvas.height,
            timestamp: new Date()
          })
        })
      })
    }

    throw new Error('html2canvas not available')
  }

  downloadScreenshot(result: ScreenshotResult, filename?: string) {
    const link = document.createElement('a')
    link.download = filename || `screenshot-${Date.now()}.png`
    link.href = result.dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export class VisualGuideBuilder {
  private steps: VisualGuideStep[] = []
  private currentGuide: Partial<VisualGuide> = {}

  constructor(private screenshotService: ScreenshotService) {}

  startGuide(title: string, description: string, category: string = 'general'): this {
    this.currentGuide = {
      id: `guide_${Date.now()}`,
      title,
      description,
      category,
      difficulty: 'beginner',
      estimatedTime: 0,
      steps: [],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0'
    }
    this.steps = []
    return this
  }

  async addStep(
    title: string,
    description: string,
    options: {
      captureScreenshot?: boolean
      element?: string
      action?: VisualGuideStep['action']
      coordinates?: { x: number; y: number }
      text?: string
      duration?: number
    } = {}
  ): Promise<this> {
    const step: VisualGuideStep = {
      id: `step_${this.steps.length + 1}`,
      title,
      description,
      ...(options.action ? { action: options.action } : {}),
      ...(options.element ? { element: options.element } : {}),
      ...(options.coordinates ? { coordinates: options.coordinates } : {}),
      ...(options.text ? { text: options.text } : {}),
      ...(options.duration ? { duration: options.duration } : {})
    }

    if (options.captureScreenshot) {
      try {
        if (options.element) {
          step.screenshot = await this.screenshotService.captureElement(options.element)
        } else {
          step.screenshot = await this.screenshotService.captureScreen()
        }
      } catch (error) {
        console.warn('Failed to capture screenshot for step:', error)
      }
    }

    this.steps.push(step)
    return this
  }

  setDifficulty(difficulty: VisualGuide['difficulty']): this {
    this.currentGuide.difficulty = difficulty
    return this
  }

  setEstimatedTime(minutes: number): this {
    this.currentGuide.estimatedTime = minutes
    return this
  }

  addTags(...tags: string[]): this {
    this.currentGuide.tags = [...(this.currentGuide.tags || []), ...tags]
    return this
  }

  setAuthor(author: string): this {
    this.currentGuide.author = author
    return this
  }

  build(): VisualGuide {
    if (!this.currentGuide.title || !this.currentGuide.description) {
      throw new Error('Guide title and description are required')
    }

    const guide: VisualGuide = {
      ...this.currentGuide,
      steps: [...this.steps],
      updatedAt: new Date()
    } as VisualGuide

    // Reset builder state
    this.steps = []
    this.currentGuide = {}

    return guide
  }

  async buildFromRecording(
    title: string,
    description: string,
    actions: Array<{
      type: 'click' | 'type' | 'scroll' | 'wait'
      element?: string
      coordinates?: { x: number; y: number }
      text?: string
      timestamp: number
    }>
  ): Promise<VisualGuide> {
    this.startGuide(title, description)

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const nextAction = actions[i + 1]
      
      let stepTitle = ''
      let stepDescription = ''

      if (action) {
        switch (action.type) {
          case 'click':
            stepTitle = `Click ${action.element || 'element'}`
            stepDescription = `Click on the ${action.element || 'specified element'}`
            break
          case 'type':
            stepTitle = `Type "${action.text}"`
            stepDescription = `Enter the text "${action.text}" in the input field`
            break
          case 'scroll':
            stepTitle = 'Scroll page'
            stepDescription = 'Scroll to view more content'
            break
          case 'wait':
            stepTitle = 'Wait'
            stepDescription = 'Wait for the page to load'
            break
        }
      } else {
        stepTitle = 'Unknown action'
        stepDescription = 'Perform an action'
      }

      await this.addStep(stepTitle, stepDescription, {
        captureScreenshot: true,
        ...(action?.element ? { element: action.element } : {}),
        ...(action?.type ? { action: action.type } : {}),
        ...(action?.coordinates ? { coordinates: action.coordinates } : {}),
        ...(action?.text ? { text: action.text } : {}),
        ...(nextAction && action ? { duration: nextAction.timestamp - action.timestamp } : {})
      })
    }

    return this.build()
  }
}

// Export singleton instance
export const screenshotService = new ScreenshotService()

// Export default
export default screenshotService