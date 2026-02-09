/**
 * @jest-environment jsdom
 * 
 * Unit Tests for Button Component
 * Feature: design-system-consistency
 */

import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button } from '@/components/ui/Button'

describe('Button Component Unit Tests', () => {
  /**
   * Test: Button renders with primary variant correctly
   * Requirements: 1.1
   */
  it('renders with primary variant correctly', () => {
    const { container } = render(<Button variant="primary">Primary Button</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button).toHaveTextContent('Primary Button')
    
    const className = button?.className || ''
    expect(className).toContain('bg-blue-600')
    expect(className).toContain('text-white')
    expect(className).toContain('hover:bg-blue-700')
  })

  /**
   * Test: Button renders with secondary variant correctly
   * Requirements: 1.1
   */
  it('renders with secondary variant correctly', () => {
    const { container } = render(<Button variant="secondary">Secondary Button</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button).toHaveTextContent('Secondary Button')
    
    const className = button?.className || ''
    expect(className).toContain('bg-gray-100')
    expect(className).toContain('text-gray-900')
    expect(className).toContain('hover:bg-gray-200')
  })

  /**
   * Test: Button renders with outline variant correctly
   * Requirements: 1.1
   */
  it('renders with outline variant correctly', () => {
    const { container } = render(<Button variant="outline">Outline Button</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button).toHaveTextContent('Outline Button')
    
    const className = button?.className || ''
    expect(className).toContain('border-2')
    expect(className).toContain('border-blue-600')
    expect(className).toContain('text-blue-600')
    expect(className).toContain('hover:bg-blue-50')
  })

  /**
   * Test: Button renders with all sizes correctly
   * Requirements: 1.7
   */
  it('renders with small size correctly', () => {
    const { container } = render(<Button size="sm">Small Button</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    
    const className = button?.className || ''
    expect(className).toContain('px-3')
    expect(className).toContain('py-1.5')
    expect(className).toContain('text-sm')
  })

  it('renders with medium size correctly', () => {
    const { container } = render(<Button size="md">Medium Button</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    
    const className = button?.className || ''
    expect(className).toContain('px-4')
    expect(className).toContain('py-2')
    expect(className).toContain('text-sm')
  })

  it('renders with large size correctly', () => {
    const { container } = render(<Button size="lg">Large Button</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    
    const className = button?.className || ''
    expect(className).toContain('px-6')
    expect(className).toContain('py-3')
    expect(className).toContain('text-base')
  })

  /**
   * Test: Button is disabled when disabled=true
   * Requirements: 7.3
   */
  it('is disabled when disabled prop is true', () => {
    const { container } = render(<Button disabled>Disabled Button</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button).toBeDisabled()
    
    const className = button?.className || ''
    expect(className).toContain('disabled:opacity-50')
    expect(className).toContain('disabled:cursor-not-allowed')
  })

  /**
   * Test: Button accepts custom className
   * Requirements: 1.1
   */
  it('accepts custom className and merges it correctly', () => {
    const { container } = render(
      <Button className="custom-class">Custom Button</Button>
    )
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    
    const className = button?.className || ''
    expect(className).toContain('custom-class')
    
    // Should still have base styles
    expect(className).toContain('rounded-lg')
    expect(className).toContain('font-medium')
  })

  /**
   * Test: Button forwards onClick handler correctly
   * Requirements: 1.1
   */
  it('forwards onClick handler correctly', () => {
    const handleClick = jest.fn()
    const { container } = render(
      <Button onClick={handleClick}>Click Me</Button>
    )
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    
    if (button) {
      fireEvent.click(button)
    }
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  /**
   * Test: Button forwards all HTML button attributes
   * Requirements: 1.1
   */
  it('forwards all HTML button attributes', () => {
    const { container } = render(
      <Button type="submit" name="submit-button" data-testid="test-button">
        Submit
      </Button>
    )
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveAttribute('name', 'submit-button')
    expect(button).toHaveAttribute('data-testid', 'test-button')
  })

  /**
   * Test: Button renders children correctly
   * Requirements: 1.1
   */
  it('renders children correctly', () => {
    const { container } = render(
      <Button>
        <span>Icon</span>
        <span>Text</span>
      </Button>
    )
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button?.querySelector('span')).toBeTruthy()
    expect(button?.textContent).toContain('Icon')
    expect(button?.textContent).toContain('Text')
  })

  /**
   * Test: Button has correct default props
   * Requirements: 1.1, 1.7
   */
  it('has correct default props', () => {
    const { container } = render(<Button>Default Button</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button).not.toBeDisabled()
    
    const className = button?.className || ''
    
    // Should default to primary variant
    expect(className).toContain('bg-blue-600')
    
    // Should default to medium size
    expect(className).toContain('px-4')
    expect(className).toContain('py-2')
    expect(className).toContain('text-sm')
  })

  /**
   * Test: Button maintains accessibility attributes
   * Requirements: 7.3
   */
  it('maintains accessibility attributes', () => {
    const { container } = render(
      <Button aria-label="Accessible Button" aria-describedby="description">
        Button
      </Button>
    )
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button).toHaveAttribute('aria-label', 'Accessible Button')
    expect(button).toHaveAttribute('aria-describedby', 'description')
  })

  /**
   * Test: Button with long text content
   * Requirements: 1.1
   */
  it('handles long text content correctly', () => {
    const longText = 'This is a very long button text that should still render correctly'
    const { container } = render(<Button>{longText}</Button>)
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    expect(button).toHaveTextContent(longText)
  })

  /**
   * Test: Button combination of variant and size
   * Requirements: 1.1, 1.7
   */
  it('handles combination of variant and size correctly', () => {
    const { container } = render(
      <Button variant="outline" size="lg">Large Outline</Button>
    )
    const button = container.querySelector('button')
    
    expect(button).toBeTruthy()
    
    const className = button?.className || ''
    
    // Should have outline variant styles
    expect(className).toContain('border-blue-600')
    
    // Should have large size styles
    expect(className).toContain('px-6')
    expect(className).toContain('py-3')
    expect(className).toContain('text-base')
  })
})
