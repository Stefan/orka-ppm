/**
 * Error Handler Service
 * Requirements: 6.2, 7.4, 8.4
 */

export type ErrorType =
  | 'permission_denied'
  | 'data_load_failed'
  | 'save_failed'
  | 'validation_failed'
  | 'reorder_failed'
  | 'config_invalid'
  | 'state_corrupted'

export interface NestedGridError {
  type: ErrorType
  message: string
  context?: unknown
  recoverable: boolean
}

export interface ErrorResponse {
  userMessage: string
  action: 'retry' | 'restore' | 'alternative' | 'none'
}

const USER_MESSAGES: Record<ErrorType, string> = {
  permission_denied: 'You do not have permission for this action.',
  data_load_failed: 'Failed to load data. Please try again.',
  save_failed: 'Failed to save. Please try again.',
  validation_failed: 'Invalid value. Please check your input.',
  reorder_failed: 'Failed to reorder. Restoring original order.',
  config_invalid: 'Invalid configuration. Please check the settings.',
  state_corrupted: 'State could not be restored. Using default.',
}

export function handleError(error: NestedGridError): ErrorResponse {
  const userMessage = USER_MESSAGES[error.type] ?? error.message
  let action: ErrorResponse['action'] = 'none'
  if (error.recoverable) {
    if (error.type === 'data_load_failed' || error.type === 'save_failed') action = 'retry'
    if (error.type === 'reorder_failed') action = 'restore'
  }
  return { userMessage, action }
}

export function isRecoverableError(error: unknown): boolean {
  if (typeof error === 'object' && error && 'code' in error) {
    const codes = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR']
    return codes.includes((error as { code?: string }).code ?? '')
  }
  return false
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (!isRecoverableError(error)) throw error
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}
