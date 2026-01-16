/**
 * Monte Carlo Worker Manager
 * Provides a typed interface for using the Monte Carlo web worker
 */

export interface MonteCarloRisk {
  id: string
  name: string
  category: string
  impactType: 'COST' | 'SCHEDULE' | 'BOTH'
  baselineImpact: number
  probabilityDistribution: {
    distributionType: string
    parameters: Record<string, number>
  }
}

export interface MonteCarloConfig {
  risks: MonteCarloRisk[]
  iterations?: number
  correlations?: any
  randomSeed?: number | null
  baselineCosts?: Record<string, number>
  scheduleData?: any
}

export interface MonteCarloResult {
  costOutcomes: number[]
  scheduleOutcomes: number[]
  riskContributions: Record<string, number[]>
  statistics: {
    cost: StatisticsResult
    schedule: StatisticsResult
  }
  iterations: number
}

export interface StatisticsResult {
  mean: number
  median: number
  stdDev: number
  variance: number
  min: number
  max: number
  p10: number
  p25: number
  p75: number
  p90: number
  p95: number
}

export interface ProgressCallback {
  (progress: { current: number; total: number; percentage: number }): void
}

class MonteCarloWorkerManager {
  private worker: Worker | null = null
  private taskCounter = 0
  private pendingTasks = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    onProgress?: ProgressCallback
  }>()

  /**
   * Initialize the worker
   */
  private initWorker(): void {
    if (this.worker) return

    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not supported in this environment')
    }

    this.worker = new Worker('/workers/monte-carlo.js')
    
    this.worker.onmessage = (event) => {
      const { taskId, result, error, success, type, progress } = event.data

      // Handle progress updates
      if (type === 'progress' && progress) {
        const tasks = Array.from(this.pendingTasks.values())
        tasks.forEach(task => {
          if (task.onProgress) {
            task.onProgress(progress)
          }
        })
        return
      }

      // Handle task completion
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
      console.error('Monte Carlo worker error:', error)
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
  private sendTask<T>(type: string, data: any, onProgress?: ProgressCallback): Promise<T> {
    this.initWorker()

    const taskId = `task-${++this.taskCounter}-${Date.now()}`

    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject, onProgress })

      this.worker!.postMessage({
        taskId,
        type,
        data
      })
    })
  }

  /**
   * Run a Monte Carlo simulation
   */
  async runSimulation(
    config: MonteCarloConfig,
    onProgress?: ProgressCallback
  ): Promise<MonteCarloResult> {
    return this.sendTask<MonteCarloResult>('run-simulation', config, onProgress)
  }

  /**
   * Calculate statistics for outcomes
   */
  async calculateStatistics(outcomes: number[]): Promise<StatisticsResult> {
    return this.sendTask<StatisticsResult>('calculate-statistics', { outcomes })
  }

  /**
   * Calculate percentiles
   */
  async calculatePercentiles(
    outcomes: number[],
    percentiles: number[]
  ): Promise<Record<string, number>> {
    return this.sendTask<Record<string, number>>('calculate-percentiles', {
      outcomes,
      percentiles
    })
  }

  /**
   * Calculate risk contributions
   */
  async calculateRiskContributions(
    riskData: Record<string, number[]>
  ): Promise<Record<string, StatisticsResult>> {
    return this.sendTask<Record<string, StatisticsResult>>('calculate-risk-contributions', {
      riskData
    })
  }

  /**
   * Generate distribution samples
   */
  async generateDistribution(
    distributionType: string,
    parameters: Record<string, number>,
    samples: number
  ): Promise<number[]> {
    return this.sendTask<number[]>('generate-distribution', {
      distributionType,
      parameters,
      samples
    })
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
export const monteCarloWorker = new MonteCarloWorkerManager()

// Export class for testing
export { MonteCarloWorkerManager }
