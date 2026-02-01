/**
 * Unit tests for Voice Control (Task 47.4)
 */

import { parseVoiceCommand, isVoiceControlSupported, VoiceCommand } from '@/lib/voice-control'

describe('Voice Control', () => {
  describe('parseVoiceCommand', () => {
    it('parses "show project X"', () => {
      const cmd = parseVoiceCommand('show project Alpha')
      expect(cmd.type).toBe('show_project')
      expect(cmd.payload).toBe('Alpha')
      expect(cmd.confidence).toBeGreaterThanOrEqual(0.5)
    })

    it('parses "filter by vendor Y"', () => {
      const cmd = parseVoiceCommand('filter by vendor Acme Corp')
      expect(cmd.type).toBe('filter_vendor')
      expect(cmd.payload).toBe('Acme Corp')
    })

    it('parses "refresh" and "refresh data"', () => {
      expect(parseVoiceCommand('refresh').type).toBe('refresh')
      expect(parseVoiceCommand('refresh data').type).toBe('refresh')
    })

    it('returns unknown for unrecognized text', () => {
      const cmd = parseVoiceCommand('hello world')
      expect(cmd.type).toBe('unknown')
    })

    it('fallback for unsupported browsers', () => {
      const supported = isVoiceControlSupported()
      expect(typeof supported).toBe('boolean')
    })
  })
})
