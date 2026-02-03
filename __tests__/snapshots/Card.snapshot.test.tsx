/**
 * Snapshot test: Card composition (dashboard-style)
 * Enterprise Test Strategy - Section 8 (Phase 1)
 */

import React from 'react'
import { render } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card'

describe('Card snapshot', () => {
  it('matches snapshot for dashboard card with header and content', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
          <CardDescription>Active projects and health summary</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">3 active, 2 at risk</p>
        </CardContent>
      </Card>
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot with padding and border', () => {
    const { container } = render(
      <Card padding="lg" shadow="md" border>
        <CardContent>Content only</CardContent>
      </Card>
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
