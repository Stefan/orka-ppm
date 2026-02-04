/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Alert } from '../Alert'

describe('Alert', () => {
  it('renders children', () => {
    render(<Alert>Message</Alert>)
    expect(screen.getByText('Message')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<Alert title="Title">Message</Alert>)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Message')).toBeInTheDocument()
  })

  it('calls onDismiss when dismissible and close clicked', async () => {
    const onDismiss = jest.fn()
    render(<Alert dismissible onDismiss={onDismiss}>Message</Alert>)
    const btn = screen.getByRole('button')
    await userEvent.click(btn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
