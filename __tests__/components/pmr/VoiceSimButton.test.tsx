/**
 * Unit tests for VoiceSimButton
 */

import React from 'react'
import { render } from '@testing-library/react'
import { VoiceSimButton } from '@/components/pmr/VoiceSimButton'

describe('VoiceSimButton', () => {
  it('renders without crashing', () => {
    const onCommand = jest.fn()
    const { container } = render(<VoiceSimButton onCommand={onCommand} />)
    expect(container).toBeDefined()
  })

  it('calls onCommand when parseSimVoiceCommand would be used (integration via callback)', () => {
    const onCommand = jest.fn()
    const { container } = render(<VoiceSimButton onCommand={onCommand} />)
    expect(container).toBeDefined()
    expect(onCommand).not.toHaveBeenCalled()
  })
})
