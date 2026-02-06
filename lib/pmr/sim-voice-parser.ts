/**
 * Parser for voice commands in Predictive Sim UI.
 * Maps transcript to: set_param (budget_uncertainty, schedule_uncertainty), run_scenario (name), run_simulation.
 * Requirements: R-PS4
 */

export type SimVoiceAction =
  | { action: 'set_param'; param: 'budget_uncertainty' | 'schedule_uncertainty'; value: number }
  | { action: 'run_scenario'; scenarioName: string }
  | { action: 'run_simulation' }
  | { action: 'unknown'; message: string }

const BUDGET_PATTERNS = [
  /set\s+budget\s+uncertainty\s+to\s+(\d+)/i,
  /budget\s+uncertainty\s+(\d+)/i,
  /budget\s+uncertainty\s+(\d+)\s*percent/i,
]
const SCHEDULE_PATTERNS = [
  /set\s+schedule\s+uncertainty\s+to\s+(\d+)/i,
  /schedule\s+uncertainty\s+(\d+)/i,
  /schedule\s+uncertainty\s+(\d+)\s*percent/i,
]
const RUN_SCENARIO_PATTERNS = [
  /run\s+(?:the\s+)?(?:scenario\s+)?["']?([a-z0-9_\s+-]+)["']?/i,
  /run\s+scenario\s+([a-z0-9_\s+-]+)/i,
  /(?:start|execute)\s+scenario\s+([a-z0-9_\s+-]+)/i,
]
const RUN_SIM_PATTERNS = [
  /run\s+simulation/i,
  /start\s+simulation/i,
  /execute\s+simulation/i,
]

/**
 * Parse voice transcript into a sim command.
 */
export function parseSimVoiceCommand(transcript: string): SimVoiceAction {
  const t = transcript.trim()
  if (!t) return { action: 'unknown', message: 'Empty input' }

  for (const pattern of BUDGET_PATTERNS) {
    const m = t.match(pattern)
    if (m && m[1]) {
      const v = Math.min(100, Math.max(0, parseInt(m[1], 10)))
      return { action: 'set_param', param: 'budget_uncertainty', value: v / 100 }
    }
  }
  for (const pattern of SCHEDULE_PATTERNS) {
    const m = t.match(pattern)
    if (m && m[1]) {
      const v = Math.min(100, Math.max(0, parseInt(m[1], 10)))
      return { action: 'set_param', param: 'schedule_uncertainty', value: v / 100 }
    }
  }
  for (const pattern of RUN_SIM_PATTERNS) {
    if (pattern.test(t)) return { action: 'run_simulation' }
  }
  for (const pattern of RUN_SCENARIO_PATTERNS) {
    const m = t.match(pattern)
    if (m && m[1]) {
      const name = m[1].trim()
      if (name.length > 0) return { action: 'run_scenario', scenarioName: name }
    }
  }

  return { action: 'unknown', message: 'Befehl nicht erkannt. Versuche z.B. "Set budget uncertainty 20" oder "Run optimistic scenario".' }
}
