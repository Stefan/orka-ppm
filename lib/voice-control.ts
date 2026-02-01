// Voice Control for Costbook (Task 47)
// Web Speech API integration for voice commands.

export type VoiceCommandType = 'show_project' | 'filter_vendor' | 'refresh' | 'unknown'

export interface VoiceCommand {
  type: VoiceCommandType
  payload?: string
  confidence: number
}

const COMMAND_PATTERNS: { pattern: RegExp; type: VoiceCommandType; extract?: (match: RegExpMatchArray) => string }[] = [
  { pattern: /show\s+project\s+(.+)/i, type: 'show_project', extract: m => m[1].trim() },
  { pattern: /filter\s+by\s+vendor\s+(.+)/i, type: 'filter_vendor', extract: m => m[1].trim() },
  { pattern: /refresh\s*(data)?/i, type: 'refresh' }
]

/**
 * Parse spoken text into a Costbook voice command.
 */
export function parseVoiceCommand(transcript: string): VoiceCommand {
  const t = transcript.trim()
  for (const { pattern, type, extract } of COMMAND_PATTERNS) {
    const match = t.match(pattern)
    if (match) {
      return {
        type,
        payload: extract?.(match),
        confidence: 0.9
      }
    }
  }
  return { type: 'unknown', confidence: 0 }
}

/**
 * Check if Web Speech API is supported.
 */
export function isVoiceControlSupported(): boolean {
  return typeof window !== 'undefined' && 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}
