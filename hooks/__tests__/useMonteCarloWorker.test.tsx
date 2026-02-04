/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useMonteCarloWorker } from '../useMonteCarloWorker'

const mockRunSimulation = jest.fn()

jest.mock('@/lib/workers', () => ({
  monteCarloWorker: {
    runSimulation: (
      config: unknown,
      onProgress?: (p: { current: number; total: number; percentage: number }) => void
    ) => {
      if (onProgress) {
        onProgress({ current: 5000, total: 10000, percentage: 50 })
        onProgress({ current: 10000, total: 10000, percentage: 100 })
      }
      return mockRunSimulation(config)
    },
  },
}))

// jsdom may not define Worker; hook uses typeof Worker !== 'undefined'
beforeAll(() => {
  if (typeof global.Worker === 'undefined') {
    (global as any).Worker = class Worker {}
  }
})

describe('useMonteCarloWorker', () => {
  beforeEach(() => {
    mockRunSimulation.mockReset()
  })

  it('returns initial state', () => {
    const { result } = renderHook(() => useMonteCarloWorker())
    expect(result.current.isRunning).toBe(false)
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.progress).toEqual({ current: 0, total: 0, percentage: 0 })
    expect(typeof result.current.runSimulation).toBe('function')
    expect(typeof result.current.isSupported).toBe('boolean')
  })

  it('runSimulation runs and sets result', async () => {
    const mockResult = {
      costOutcomes: [100],
      scheduleOutcomes: [10],
      riskContributions: {},
      statistics: { cost: {} as any, schedule: {} as any },
      iterations: 10000,
    }
    mockRunSimulation.mockResolvedValue(mockResult)

    const { result } = renderHook(() => useMonteCarloWorker())

    await act(async () => {
      await result.current.runSimulation({
        iterations: 10000,
        projectId: 'p1',
        risks: [],
      })
    })

    expect(mockRunSimulation).toHaveBeenCalled()
    expect(result.current.result).toEqual(mockResult)
    expect(result.current.isRunning).toBe(false)
  })

  it('runSimulation sets error on failure', async () => {
    mockRunSimulation.mockRejectedValue(new Error('Worker error'))

    const { result } = renderHook(() => useMonteCarloWorker())

    await act(async () => {
      try {
        await result.current.runSimulation({
          iterations: 1000,
          projectId: 'p1',
          risks: [],
        })
      } catch {
        // expected
      }
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Worker error')
    expect(result.current.isRunning).toBe(false)
  })

  it('calls onProgress and onComplete when provided', async () => {
    const onProgress = jest.fn()
    const onComplete = jest.fn()
    const mockResult = {
      costOutcomes: [1],
      scheduleOutcomes: [1],
      riskContributions: {},
      statistics: { cost: {} as any, schedule: {} as any },
      iterations: 10000,
    }
    mockRunSimulation.mockResolvedValue(mockResult)

    const { result } = renderHook(() =>
      useMonteCarloWorker({ onProgress, onComplete })
    )

    await act(async () => {
      await result.current.runSimulation({
        iterations: 10000,
        projectId: 'p1',
        risks: [],
      })
    })

    expect(onProgress).toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledWith(mockResult)
  })
})
