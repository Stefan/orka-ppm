/**
 * Unit tests for useClickOutside hook
 */

import { renderHook } from '@testing-library/react'
import { useClickOutside } from '../useClickOutside'

describe('useClickOutside', () => {
  it('returns a ref object', () => {
    const handler = jest.fn()
    const { result } = renderHook(() => useClickOutside(handler))
    expect(result.current).toBeDefined()
    expect(result.current).toHaveProperty('current')
    expect(result.current.current).toBeNull()
  })

  it('calls handler when click is outside element', () => {
    const handler = jest.fn()
    const { result } = renderHook(() => useClickOutside(handler))
    const div = document.createElement('div')
    document.body.appendChild(div)
    ;(result.current as React.RefObject<HTMLElement>).current = div

    const outside = document.createElement('span')
    document.body.appendChild(outside)

    const event = new MouseEvent('mousedown', { bubbles: true })
    Object.defineProperty(event, 'target', { value: outside, writable: false })
    document.dispatchEvent(event)

    expect(handler).toHaveBeenCalledTimes(1)

    document.body.removeChild(div)
    document.body.removeChild(outside)
  })

  it('does not call handler when click is inside element', () => {
    const handler = jest.fn()
    const { result } = renderHook(() => useClickOutside(handler))
    const div = document.createElement('div')
    const child = document.createElement('span')
    div.appendChild(child)
    document.body.appendChild(div)
    ;(result.current as React.RefObject<HTMLElement>).current = div

    const event = new MouseEvent('mousedown', { bubbles: true })
    Object.defineProperty(event, 'target', { value: child, writable: false })
    document.dispatchEvent(event)

    expect(handler).not.toHaveBeenCalled()

    document.body.removeChild(div)
  })

  it('does not call handler when ref current is null', () => {
    const handler = jest.fn()
    renderHook(() => useClickOutside(handler))
    const event = new MouseEvent('mousedown', { bubbles: true })
    document.dispatchEvent(event)
    expect(handler).not.toHaveBeenCalled()
  })
})
