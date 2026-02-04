/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders with CardHeader and CardContent', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('renders CardFooter', () => {
    render(
      <Card>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })
})
