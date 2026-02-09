'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { parseSimVoiceCommand, type SimVoiceAction } from '@/lib/pmr/sim-voice-parser'

export interface VoiceSimButtonProps {
  onCommand: (command: SimVoiceAction) => void
  disabled?: boolean
  /** Optional: show last parsed command for feedback */
  showFeedback?: boolean
}

export function VoiceSimButton({
  onCommand,
  disabled = false,
  showFeedback = true,
}: VoiceSimButtonProps) {
  const [listening, setListening] = useState(false)
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    setSupported(ok)
  }, [])

  const handleResult = useCallback(
    (transcript: string) => {
      const cmd = parseSimVoiceCommand(transcript)
      setLastMessage(
        cmd.action === 'unknown' ? cmd.message : `Erkannt: ${transcript}`
      )
      onCommand(cmd)
    },
    [onCommand]
  )

  const startListening = useCallback(() => {
    if (!supported || disabled) return
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => import('@/types/speech-recognition').SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => import('@/types/speech-recognition').SpeechRecognitionInstance }).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'de-DE'

    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onresult = (event: import('@/types/speech-recognition').SpeechRecognitionEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? ''
      if (transcript) handleResult(transcript)
    }
    rec.onerror = () => setListening(false)

    rec.start()
  }, [supported, disabled, handleResult])

  if (!supported) return null

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={startListening}
        disabled={disabled || listening}
        className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
          listening
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700'
            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
        } disabled:opacity-50`}
        title="Sprachbefehl (z.B. Budget-Unsicherheit 20, Szenario ausführen)"
      >
        {listening ? (
          <MicOff className="h-4 w-4 mr-2" />
        ) : (
          <Mic className="h-4 w-4 mr-2" />
        )}
        {listening ? 'Höre…' : 'Sprache'}
      </button>
      {showFeedback && lastMessage && (
        <p className="mt-1 text-xs text-gray-600 dark:text-slate-400 max-w-[200px] truncate" title={lastMessage}>
          {lastMessage}
        </p>
      )}
    </div>
  )
}
