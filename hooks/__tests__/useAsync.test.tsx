/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useAsync } from '../useAsync'

describe('useAsync', () => {
  it('starts loading and then returns data when immediate is true', async () => {
    const fn = jest.fn().mockResolvedValue('done')
    const { result } = renderHook(() => useAsync(fn, true))

    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })

    expect(fn).toHaveBeenCalled()
    expect(result.current.data).toBe('done')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('does not run when immediate is false', () => {
    const fn = jest.fn().mockResolvedValue('done')
    renderHook(() => useAsync(fn, false))
    expect(fn).not.toHaveBeenCalled()
  })

  it('execute runs the function and returns result', async () => {
    const fn = jest.fn().mockResolvedValue(100)
    const { result } = renderHook(() => useAsync(fn, false))

    let value: number | undefined
    await act(async () => {
      value = await result.current.execute()
    })

    expect(value).toBe(100)
    expect(result.current.data).toBe(100)
  })

  it('sets error when promise rejects', async () => {
    const err = new Error('fail')
    const fn = jest.fn().mockRejectedValue(err)
    const { result } = renderHook(() => useAsync(fn, false))

    await act(async () => {
      try {
        await result.current.execute()
      } catch {
        // expected
      }
    })

    expect(result.current.error).toEqual(err)
    expect(result.current.data).toBeNull()
  })

  it('reset clears state', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useAsync(fn, true))

    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    expect(result.current.data).toBe('ok')

    act(() => { result.current.reset() })
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
