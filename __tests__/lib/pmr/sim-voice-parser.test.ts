/**
 * Unit tests for lib/pmr/sim-voice-parser.ts
 */

import { parseSimVoiceCommand } from '@/lib/pmr/sim-voice-parser'

describe('parseSimVoiceCommand', () => {
  it('parses "set budget uncertainty to 20"', () => {
    const cmd = parseSimVoiceCommand('set budget uncertainty to 20')
    expect(cmd.action).toBe('set_param')
    if (cmd.action === 'set_param') {
      expect(cmd.param).toBe('budget_uncertainty')
      expect(cmd.value).toBe(0.2)
    }
  })

  it('parses "budget uncertainty 30 percent"', () => {
    const cmd = parseSimVoiceCommand('budget uncertainty 30 percent')
    expect(cmd.action).toBe('set_param')
    if (cmd.action === 'set_param') {
      expect(cmd.param).toBe('budget_uncertainty')
      expect(cmd.value).toBe(0.3)
    }
  })

  it('clamps budget uncertainty to 0-100', () => {
    const cmd = parseSimVoiceCommand('set budget uncertainty to 150')
    expect(cmd.action).toBe('set_param')
    if (cmd.action === 'set_param') expect(cmd.value).toBe(1)
    const cmd2 = parseSimVoiceCommand('budget uncertainty -10')
    if (cmd2.action === 'set_param') expect(cmd2.value).toBe(0)
  })

  it('parses "set schedule uncertainty to 25"', () => {
    const cmd = parseSimVoiceCommand('set schedule uncertainty to 25')
    expect(cmd.action).toBe('set_param')
    if (cmd.action === 'set_param') {
      expect(cmd.param).toBe('schedule_uncertainty')
      expect(cmd.value).toBe(0.25)
    }
  })

  it('parses "run optimistic scenario"', () => {
    const cmd = parseSimVoiceCommand('run optimistic scenario')
    expect(cmd.action).toBe('run_scenario')
    if (cmd.action === 'run_scenario') {
      expect(cmd.scenarioName).toMatch(/optimistic/)
    }
  })

  it('parses "run scenario Worst Case"', () => {
    const cmd = parseSimVoiceCommand('run scenario Worst Case')
    expect(cmd.action).toBe('run_scenario')
    if (cmd.action === 'run_scenario') {
      expect(cmd.scenarioName).toBe('Worst Case')
    }
  })

  it('parses "run simulation"', () => {
    const cmd = parseSimVoiceCommand('run simulation')
    expect(cmd.action).toBe('run_simulation')
  })

  it('parses "start simulation"', () => {
    const cmd = parseSimVoiceCommand('start simulation')
    expect(cmd.action).toBe('run_simulation')
  })

  it('returns unknown for empty input', () => {
    const cmd = parseSimVoiceCommand('')
    expect(cmd.action).toBe('unknown')
    if (cmd.action === 'unknown') expect(cmd.message).toBeDefined()
  })

  it('returns unknown for unrecognized text', () => {
    const cmd = parseSimVoiceCommand('hello world')
    expect(cmd.action).toBe('unknown')
  })
})
