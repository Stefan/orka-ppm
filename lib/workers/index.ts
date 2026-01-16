/**
 * Web Workers for offloading heavy computations from the main thread
 */

export {
  monteCarloWorker,
  MonteCarloWorkerManager,
  type MonteCarloRisk,
  type MonteCarloConfig,
  type MonteCarloResult,
  type StatisticsResult,
  type ProgressCallback
} from './monte-carlo-worker'

export {
  dataProcessorWorker,
  DataProcessorWorkerManager,
  type FilterOptions,
  type SortOptions,
  type AggregateOptions,
  type TransformOptions,
  type SearchOptions,
  type ValidationSchema,
  type ValidationResult,
  type BatchOperation
} from './data-processor-worker'
