/**
 * Data Processor Worker Manager
 * Provides a typed interface for using the data processing web worker
 */

export interface FilterOptions {
  items: any[]
  predicate: string
}

export interface SortOptions {
  items: any[]
  compareFn: string
  direction?: 'asc' | 'desc'
}

export interface AggregateOptions {
  items: any[]
  groupBy: string | ((item: any) => string)
  aggregations: Array<{
    type: 'count' | 'sum' | 'avg' | 'min' | 'max'
    name: string
    field?: string
  }>
}

export interface TransformOptions {
  items: any[]
  transformFn: string
}

export interface SearchOptions {
  items: any[]
  query: string
  fields: string[]
}

export interface ValidationSchema {
  [field: string]: {
    required?: boolean
    type?: string
    min?: number
    max?: number
    pattern?: string
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: Array<{
    index: number
    field: string
    error: string
    value: any
  }>
  validItems: number
}

export interface BatchOperation {
  type: 'filter' | 'sort' | 'transform' | 'aggregate'
  predicate?: string
  compareFn?: string
  direction?: 'asc' | 'desc'
  transformFn?: string
  groupBy?: string
  aggregations?: Array<{
    type: 'count' | 'sum' | 'avg' | 'min' | 'max'
    name: string
    field?: string
  }>
}

class DataProcessorWorkerManager {
  private worker: Worker | null = null
  private taskCounter = 0
  private pendingTasks = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>()

  /**
   * Initialize the worker
   */
  private initWorker(): void {
    if (this.worker) return

    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not supported in this environment')
    }

    this.worker = new Worker('/workers/data-processor.js')
    
    this.worker.onmessage = (event) => {
      const { taskId, result, error, success } = event.data

      const task = this.pendingTasks.get(taskId)
      if (!task) return

      this.pendingTasks.delete(taskId)

      if (success) {
        task.resolve(result)
      } else {
        task.reject(new Error(error || 'Worker task failed'))
      }
    }

    this.worker.onerror = (error) => {
      console.error('Data processor worker error:', error)
      // Reject all pending tasks
      this.pendingTasks.forEach(task => {
        task.reject(new Error('Worker encountered an error'))
      })
      this.pendingTasks.clear()
    }
  }

  /**
   * Send a task to the worker
   */
  private sendTask<T>(type: string, data: any): Promise<T> {
    this.initWorker()

    const taskId = `task-${++this.taskCounter}-${Date.now()}`

    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject })

      this.worker!.postMessage({
        taskId,
        type,
        data
      })
    })
  }

  /**
   * Filter data based on a predicate
   */
  async filter<T = any>(items: T[], predicate: (item: T, index: number) => boolean): Promise<T[]> {
    const predicateStr = predicate.toString().replace(/^[^{]*{\s*return\s*/, '').replace(/\s*}[^}]*$/, '')
    return this.sendTask<T[]>('filter', { items, predicate: predicateStr })
  }

  /**
   * Sort data
   */
  async sort<T = any>(
    items: T[],
    compareFn: (a: T, b: T) => number,
    direction: 'asc' | 'desc' = 'asc'
  ): Promise<T[]> {
    const compareFnStr = compareFn.toString().replace(/^[^{]*{\s*return\s*/, '').replace(/\s*}[^}]*$/, '')
    return this.sendTask<T[]>('sort', { items, compareFn: compareFnStr, direction })
  }

  /**
   * Aggregate data
   */
  async aggregate(options: AggregateOptions): Promise<Record<string, any>> {
    return this.sendTask<Record<string, any>>('aggregate', options)
  }

  /**
   * Transform data
   */
  async transform<T = any, R = any>(
    items: T[],
    transformFn: (item: T, index: number) => R
  ): Promise<R[]> {
    const transformFnStr = transformFn.toString().replace(/^[^{]*{\s*return\s*/, '').replace(/\s*}[^}]*$/, '')
    return this.sendTask<R[]>('transform', { items, transformFn: transformFnStr })
  }

  /**
   * Search data
   */
  async search<T = any>(items: T[], query: string, fields: string[]): Promise<T[]> {
    return this.sendTask<T[]>('search', { items, query, fields })
  }

  /**
   * Validate data against a schema
   */
  async validate<T = any>(items: T[], schema: ValidationSchema): Promise<ValidationResult> {
    return this.sendTask<ValidationResult>('validate', { items, schema })
  }

  /**
   * Batch transform - apply multiple operations in sequence
   */
  async batchTransform<T = any>(items: T[], operations: BatchOperation[]): Promise<any> {
    return this.sendTask('batch-transform', { items, operations })
  }

  /**
   * Deduplicate data based on key fields
   */
  async deduplicate<T = any>(items: T[], keyFields: string[]): Promise<T[]> {
    return this.sendTask<T[]>('deduplicate', { items, keyFields })
  }

  /**
   * Merge multiple datasets on a common key
   */
  async merge<T = any>(datasets: T[][], mergeKey: string): Promise<T[]> {
    return this.sendTask<T[]>('merge', { datasets, mergeKey })
  }

  /**
   * Pivot data from long to wide format
   */
  async pivot<T = any>(
    items: T[],
    rowField: string,
    columnField: string,
    valueField: string
  ): Promise<any[]> {
    return this.sendTask('pivot', { items, rowField, columnField, valueField })
  }

  /**
   * Normalize data fields
   */
  async normalize<T = any>(
    items: T[],
    fields: string[],
    method: 'minmax' | 'zscore' | 'decimal' = 'minmax'
  ): Promise<T[]> {
    return this.sendTask<T[]>('normalize', { items, fields, method })
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pendingTasks.clear()
  }

  /**
   * Check if workers are supported
   */
  static isSupported(): boolean {
    return typeof Worker !== 'undefined'
  }
}

// Export singleton instance
export const dataProcessorWorker = new DataProcessorWorkerManager()

// Export class for testing
export { DataProcessorWorkerManager }
