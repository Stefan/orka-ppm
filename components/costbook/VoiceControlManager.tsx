'use client'

// Voice Control Manager for Costbook (Task 47)

import React, { useState, useCallback, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { parseVoiceCommand, isVoiceControlSupported, VoiceCommand } from '@/lib/voice-control'

export interface VoiceControlManagerProps {
  onCommand?: (cmd: VoiceCommand) => void
  className?: string
}

export function VoiceControlManager({ onCommand, className = '' }: VoiceControlManagerProps) {
  const [listening, setListening] = useState(false)
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null)
  const [supported] = useState(() => isVoiceControlSupported())

  useEffect(() => {
    if (!supported || !listening) return
    const Recognition = (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition; SpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition || (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
    if (!Recognition) return
    const rec = new Recognition()
    rec.continuous = true
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[e.results.length - 1]?.[0]?.transcript
      if (t) {
        const cmd = parseVoiceCommand(t)
        setLastCommand(cmd)
        onCommand?.(cmd)
      }
    }
    rec.start()
    return () => { try { rec.abort(); } catch { } }
  }, [supported, listening, onCommand])

  const toggle = useCallback(() => setListening(l => !l), [])

  if (!supported) return null
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className={`p-2 rounded-full ${listening ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}
        title={listening ? 'Stop listening' : 'Start voice control'}
      >
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      {lastCommand && lastCommand.type !== 'unknown' && (
        <span className="text-xs text-gray-500 dark:text-slate-400">Last: {lastCommand.type}</span>
      )}
    </div>
  )
}
