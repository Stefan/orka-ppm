/**
 * Web Worker utilities for CPU-intensive tasks
 */

import { useState, useCallback } from 'react'
import { performanceMonitor } from '../monitoring/performance'

interface WorkerTask<T = any, R = any> {
  id: string
  type: string
  data: T
  resolve: (result: R) => void
  reject: (error: Error) => void
  startTime: number
}

interface WorkerPool {
  workers: Worker[]
  taskQueue: WorkerTask[]
  activeTasks: Map<string, WorkerTask>
  workerAssignments: Map<string, number> // taskId -> workerIndex
  maxWorkers: number
}

class WebWorkerManager {
  private pools: Map<string, WorkerPool> = new Map()
  private taskIdCounter = 0

  // Create a worker pool for a specific task type
  createPool(
    workerType: string, 
    workerScript: string, 
    maxWorkers: number = navigator.hardwareConcurrency || 4
  ): void {
    if (this.pools.has(workerType)) {
      console.warn(`Worker pool for ${workerType} already exists`)
      return
    }

    const workers: Worker[] = []
    for (let i = 0; i < maxWorkers; i++) {
      const worker = new Worker(workerScript)
      worker.onmessage = (event) => this.handleWorkerMessage(workerType, event)
      worker.onerror = (error) => this.handleWorkerError(workerType, error)
      workers.push(worker)
    }

    this.pools.set(workerType, {
      workers,
      taskQueue: [],
      activeTasks: new Map(),
      workerAssignments: new Map(),
      maxWorkers
    })
  }

  // Execute a task using a worker from the pool
  async executeTask<T, R>(
    workerType: string,
    taskType: string,
    data: T,
    timeout: number = 30000
  ): Promise<R> {
    const pool = this.pools.get(workerType)
    if (!pool) {
      throw new Error(`Worker pool ${workerType} not found`)
    }

    return new Promise<R>((resolve, reject) => {
      const taskId = `${workerType}_${++this.taskIdCounter}`
      const task: WorkerTask<T, R> = {
        id: taskId,
        type: taskType,
        data,
        resolve,
        reject,
        startTime: performance.now()
      }

      // Add timeout
      const timeoutId = setTimeout(() => {
        this.cancelTask(workerType, taskId)
        reject(new Error(`Task ${taskId} timed out after ${timeout}ms`))
      }, timeout)

      // Override resolve to clear timeout and record metrics
      const originalResolve = task.resolve
      task.resolve = (result: R) => {
        clearTimeout(timeoutId)
        const duration = performance.now() - task.startTime
        performanceMonitor.recordMetric(`worker_task_${taskType}`, duration, 'custom', {
          workerType,
          taskType,
          success: true
        })
        originalResolve(result)
      }

      // Override reject to clear timeout and record metrics
      const originalReject = task.reject
      task.reject = (error: Error) => {
        clearTimeout(timeoutId)
        const duration = performance.now() - task.startTime
        performanceMonitor.recordMetric(`worker_task_${taskType}`, duration, 'custom', {
          workerType,
          taskType,
          success: false,
          error: error.message
        })
        originalReject(error)
      }

      this.scheduleTask(workerType, task)
    })
  }

  private scheduleTask(workerType: string, task: WorkerTask): void {
    const pool = this.pools.get(workerType)!
    
    // Find available worker
    const availableWorkerIndex = pool.workers.findIndex((_, index) => 
      !Array.from(pool.workerAssignments.values()).includes(index)
    )
    
    if (availableWorkerIndex !== -1) {
      const availableWorker = pool.workers[availableWorkerIndex]
      if (availableWorker) {
        // Execute immediately
        pool.activeTasks.set(task.id, task)
        pool.workerAssignments.set(task.id, availableWorkerIndex)
        availableWorker.postMessage({
          taskId: task.id,
          type: task.type,
          data: task.data
        })
      } else {
        // Queue for later if worker is not available
        pool.taskQueue.push(task)
      }
    } else {
      // Queue for later
      pool.taskQueue.push(task)
    }
  }

  private handleWorkerMessage(workerType: string, event: MessageEvent): void {
    const pool = this.pools.get(workerType)!
    const { taskId, result, error } = event.data

    const task = pool.activeTasks.get(taskId)
    if (!task) return

    pool.activeTasks.delete(taskId)

    if (error) {
      task.reject(new Error(error))
    } else {
      task.resolve(result)
    }

    // Process next task in queue
    this.processNextTask(workerType)
  }

  private handleWorkerError(workerType: string, error: ErrorEvent): void {
    console.error(`Worker error in ${workerType}:`, error)
    
    // Find and reject all active tasks for this worker
    const pool = this.pools.get(workerType)!
    pool.activeTasks.forEach(task => {
      task.reject(new Error(`Worker error: ${error.message}`))
    })
    pool.activeTasks.clear()
  }

  private processNextTask(workerType: string): void {
    const pool = this.pools.get(workerType)!
    if (pool.taskQueue.length === 0) return

    const nextTask = pool.taskQueue.shift()!
    this.scheduleTask(workerType, nextTask)
  }

  private cancelTask(workerType: string, taskId: string): void {
    const pool = this.pools.get(workerType)!
    
    // Remove from active tasks
    const task = pool.activeTasks.get(taskId)
    if (task) {
      pool.activeTasks.delete(taskId)
      return
    }

    // Remove from queue
    const queueIndex = pool.taskQueue.findIndex(t => t.id === taskId)
    if (queueIndex >= 0) {
      pool.taskQueue.splice(queueIndex, 1)
    }
  }

  // Terminate all workers and clean up
  terminate(workerType?: string): void {
    if (workerType) {
      const pool = this.pools.get(workerType)
      if (pool) {
        pool.workers.forEach(worker => worker.terminate())
        this.pools.delete(workerType)
      }
    } else {
      // Terminate all pools
      this.pools.forEach((pool) => {
        pool.workers.forEach(worker => worker.terminate())
      })
      this.pools.clear()
    }
  }

  // Get pool statistics
  getPoolStats(workerType: string) {
    const pool = this.pools.get(workerType)
    if (!pool) return null

    return {
      totalWorkers: pool.workers.length,
      activeTasks: pool.activeTasks.size,
      queuedTasks: pool.taskQueue.length,
      utilization: pool.activeTasks.size / pool.workers.length
    }
  }
}

// Singleton instance
export const workerManager = new WebWorkerManager()

// Predefined worker types
export const initializeCommonWorkers = () => {
  // Data processing worker
  workerManager.createPool('data-processor', '/workers/data-processor.js', 2)
  
  // Chart calculation worker
  workerManager.createPool('chart-calculator', '/workers/chart-calculator.js', 1)
  
  // CSV processing worker
  workerManager.createPool('csv-processor', '/workers/csv-processor.js', 1)
  
  // Image processing worker
  workerManager.createPool('image-processor', '/workers/image-processor.js', 1)
}

// Utility functions for common tasks
export const processLargeDataset = async <T, R>(
  data: T[],
  processingFunction: string,
  chunkSize: number = 1000
): Promise<R[]> => {
  const chunks = []
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize))
  }

  const results = await Promise.all(
    chunks.map(chunk => 
      workerManager.executeTask('data-processor', processingFunction, chunk)
    )
  )

  return (results as R[][]).flat()
}

export const calculateChartData = async (
  rawData: any[],
  chartType: string,
  options: any = {}
): Promise<any> => {
  return workerManager.executeTask('chart-calculator', 'calculate', {
    data: rawData,
    chartType,
    options
  })
}

export const processCSVData = async (
  csvContent: string,
  options: { hasHeader?: boolean; delimiter?: string } = {}
): Promise<any[]> => {
  return workerManager.executeTask('csv-processor', 'parse', {
    content: csvContent,
    options
  })
}

export const processImage = async (
  imageData: ImageData,
  operation: string,
  params: any = {}
): Promise<ImageData> => {
  return workerManager.executeTask('image-processor', operation, {
    imageData,
    params
  })
}

// React hook for worker tasks
export const useWorkerTask = <T, R>(
  workerType: string,
  taskType: string
) => {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<R | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (data: T) => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const taskResult = await workerManager.executeTask<T, R>(
        workerType,
        taskType,
        data
      )
      setResult(taskResult)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [workerType, taskType])

  return { execute, isLoading, result, error }
}

export default workerManager