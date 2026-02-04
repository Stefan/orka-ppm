/**
 * @jest-environment jsdom
 * 
 * Unit Tests for Card Component
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'

describe('Card Component Unit Tests', () => {
  /**
   * Test: Card renders with all padding variants correctly
   * Requirements: 3.1
   */
  it('renders with small padding correctly', () => {
    const { container } = render(
      <Card padding="sm">
        <div>Small Padding Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    expect(card).toHaveTextContent('Small Padding Card')
    
    const className = card?.className || ''
    expect(className).toContain('p-4')
  })

  it('renders with medium padding correctly', () => {
    const { container } = render(
      <Card padding="md">
        <div>Medium Padding Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    expect(card).toHaveTextContent('Medium Padding Card')
    
    const className = card?.className || ''
    expect(className).toContain('p-6')
  })

  it('renders with large padding correctly', () => {
    const { container } = render(
      <Card padding="lg">
        <div>Large Padding Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    expect(card).toHaveTextContent('Large Padding Card')
    
    const className = card?.className || ''
    expect(className).toContain('p-8')
  })

  /**
   * Test: Card renders with all shadow variants correctly
   * Requirements: 3.2
   */
  it('renders with small shadow correctly', () => {
    const { container } = render(
      <Card shadow="sm">
        <div>Small Shadow Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    
    const className = card?.className || ''
    expect(className).toContain('shadow-sm')
  })

  it('renders with medium shadow correctly', () => {
    const { container } = render(
      <Card shadow="md">
        <div>Medium Shadow Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    
    const className = card?.className || ''
    expect(className).toContain('shadow-md')
  })

  it('renders with large shadow correctly', () => {
    const { container } = render(
      <Card shadow="lg">
        <div>Large Shadow Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    
    const className = card?.className || ''
    expect(className).toContain('shadow-lg')
  })

  /**
   * Test: Card shows border when border=true
   * Requirements: 3.5
   */
  it('shows border when border prop is true', () => {
    const { container } = render(
      <Card border={true}>
        <div>Card with Border</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    
    const className = card?.className || ''
    expect(className).toContain('border')
    expect(className).toContain('border')
  })

  it('does not show border when border prop is false', () => {
    const { container } = render(
      <Card border={false}>
        <div>Card without Border</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    
    const className = card?.className || ''
    expect(className).not.toMatch(/border-gray-200|border-slate-700/)
  })

  it('shows border by default', () => {
    const { container } = render(
      <Card>
        <div>Default Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    expect(card).toBeTruthy()
    const className = card?.className || ''
    expect(className).toContain('border')
  })

  /**
   * Test: CardHeader renders with bottom border
   * Requirements: 3.4
   */
  it('CardHeader renders with bottom border', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <h3>Card Header</h3>
        </CardHeader>
      </Card>
    )
    
    // Get the CardHeader div (second div, first is Card)
    const cardHeader = container.querySelectorAll('div')[1]
    
    expect(cardHeader).toBeTruthy()
    expect(cardHeader).toHaveTextContent('Card Header')
    
    const className = cardHeader?.className || ''
    expect(className).toContain('border-b')
    expect(className).toContain('border')
    expect(className).toContain('pb-4')
    expect(className).toContain('mb-4')
  })

  /**
   * Test: Card with CardHeader and CardContent renders correctly
   * Requirements: 3.4, 3.5
   */
  it('renders with CardHeader and CardContent correctly', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <h3>Header Title</h3>
        </CardHeader>
        <CardContent>
          <p>Card content goes here</p>
        </CardContent>
      </Card>
    )
    
    const card = container.querySelector('div')
    expect(card).toBeTruthy()
    
    // Check CardHeader
    const cardHeader = container.querySelectorAll('div')[1]
    expect(cardHeader).toBeTruthy()
    expect(cardHeader).toHaveTextContent('Header Title')
    
    const headerClassName = cardHeader?.className || ''
    expect(headerClassName).toContain('border-b')
    expect(headerClassName).toContain('border')
    
    // Check CardContent
    const cardContent = container.querySelectorAll('div')[2]
    expect(cardContent).toBeTruthy()
    expect(cardContent).toHaveTextContent('Card content goes here')
  })

  /**
   * Test: Card accepts custom className
   * Requirements: 3.1
   */
  it('accepts custom className and merges it correctly', () => {
    const { container } = render(
      <Card className="custom-card-class">
        <div>Custom Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    
    const className = card?.className || ''
    expect(className).toContain('custom-card-class')
    
    // Should still have base styles
    expect(className).toMatch(/bg-white|bg-slate/)
    expect(className).toContain('rounded-xl')
  })

  /**
   * Test: CardHeader accepts custom className
   * Requirements: 3.4
   */
  it('CardHeader accepts custom className and merges it correctly', () => {
    const { container } = render(
      <Card>
        <CardHeader className="custom-header-class">
          <h3>Header</h3>
        </CardHeader>
      </Card>
    )
    
    const cardHeader = container.querySelectorAll('div')[1]
    
    expect(cardHeader).toBeTruthy()
    
    const className = cardHeader?.className || ''
    expect(className).toContain('custom-header-class')
    
    // Should still have base styles
    expect(className).toContain('border-b')
    expect(className).toContain('border')
  })

  /**
   * Test: CardContent accepts custom className
   * Requirements: 3.1
   */
  it('CardContent accepts custom className', () => {
    const { container } = render(
      <Card>
        <CardContent className="custom-content-class">
          <p>Content</p>
        </CardContent>
      </Card>
    )
    
    const cardContent = container.querySelectorAll('div')[1]
    
    expect(cardContent).toBeTruthy()
    
    const className = cardContent?.className || ''
    expect(className).toContain('custom-content-class')
  })

  /**
   * Test: Card forwards all HTML div attributes
   * Requirements: 3.1
   */
  it('forwards all HTML div attributes', () => {
    const { container } = render(
      <Card data-testid="test-card" role="region" aria-label="Test Card">
        <div>Card Content</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    expect(card).toHaveAttribute('data-testid', 'test-card')
    expect(card).toHaveAttribute('role', 'region')
    expect(card).toHaveAttribute('aria-label', 'Test Card')
  })

  /**
   * Test: Card has correct default props
   * Requirements: 3.1, 3.2
   */
  it('has correct default props', () => {
    const { container } = render(
      <Card>
        <div>Default Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    
    const className = card?.className || ''
    
    // Should default to medium padding
    expect(className).toContain('p-6')
    
    // Should default to small shadow
    expect(className).toContain('shadow-sm')
    // Border is on by default
    expect(className).toContain('border')
  })

  /**
   * Test: Card combination of all props
   * Requirements: 3.1, 3.2, 3.5
   */
  it('handles combination of all props correctly', () => {
    const { container } = render(
      <Card padding="lg" shadow="lg" border={true}>
        <div>Full Featured Card</div>
      </Card>
    )
    const card = container.querySelector('div')
    
    expect(card).toBeTruthy()
    
    const className = card?.className || ''
    
    // Should have large padding
    expect(className).toContain('p-8')
    
    // Should have large shadow
    expect(className).toContain('shadow-lg')
    
    // Should have border
    expect(className).toContain('border')
    expect(className).toContain('border')
    
    // Should have base styles
    expect(className).toMatch(/bg-white|bg-slate/)
    expect(className).toContain('rounded-xl')
  })

  /**
   * Test: Card with nested complex content
   * Requirements: 3.1
   */
  it('handles nested complex content correctly', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <h3>Complex Header</h3>
          <p>Subtitle</p>
        </CardHeader>
        <CardContent>
          <div>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    )
    
    const card = container.querySelector('div')
    expect(card).toBeTruthy()
    
    // Check all content is rendered
    expect(card).toHaveTextContent('Complex Header')
    expect(card).toHaveTextContent('Subtitle')
    expect(card).toHaveTextContent('Paragraph 1')
    expect(card).toHaveTextContent('Paragraph 2')
    expect(card).toHaveTextContent('Item 1')
    expect(card).toHaveTextContent('Item 2')
  })

  /**
   * Test: Multiple Cards maintain independent styles
   * Requirements: 3.1, 3.2
   */
  it('multiple Cards maintain independent styles', () => {
    const { container } = render(
      <div>
        <Card padding="sm" shadow="sm">
          <div>Card 1</div>
        </Card>
        <Card padding="lg" shadow="lg" border={true}>
          <div>Card 2</div>
        </Card>
      </div>
    )
    
    // Get all divs and filter for Card components (they have bg-white class)
    const allDivs = Array.from(container.querySelectorAll('div'))
    const cards = allDivs.filter(div => div.className.includes('bg-white') || div.className.includes('bg-slate'))
    
    expect(cards.length).toBe(2)
    
    // First card
    const card1ClassName = cards[0]?.className || ''
    expect(card1ClassName).toContain('p-4')
    expect(card1ClassName).toContain('shadow-sm')
    expect(card1ClassName).toBeDefined()
    
    // Second card
    const card2ClassName = cards[1]?.className || ''
    expect(card2ClassName).toContain('p-8')
    expect(card2ClassName).toContain('shadow-lg')
    expect(card2ClassName).toContain('border')
  })
})
