/**
 * Global type declarations for Web Speech API (SpeechRecognition).
 * Not all browsers include these in TypeScript lib; this file augments the global scope.
 */
declare global {
  interface SpeechRecognitionEventMap {
    audioend: Event
    audiostart: Event
    end: Event
    error: Event
    nomatch: Event
    result: SpeechRecognitionEvent
    soundend: Event
    soundstart: Event
    speechend: Event
    speechstart: Event
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    grammars: SpeechGrammarList
    interimResults: boolean
    lang: string
    maxAlternatives: number
    onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null
    onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null
    onend: ((this: SpeechRecognition, ev: Event) => void) | null
    onerror: ((this: SpeechRecognition, ev: Event) => void) | null
    onnomatch: ((this: SpeechRecognition, ev: Event) => void) | null
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
    onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null
    onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null
    onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null
    onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null
    onstart: ((this: SpeechRecognition, ev: Event) => void) | null
    start(): void
    stop(): void
    abort(): void
    addEventListener<K extends keyof SpeechRecognitionEventMap>(
      type: K,
      listener: (this: SpeechRecognition, ev: SpeechRecognitionEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ): void
  }

  const SpeechRecognition: {
    prototype: SpeechRecognition
    new (): SpeechRecognition
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionResultList {
    readonly length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }

  interface SpeechRecognitionResult {
    readonly length: number
    readonly isFinal: boolean
    item(index: number): SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string
    readonly confidence: number
  }

  interface SpeechGrammarList {
    readonly length: number
    addFromString(string: string, weight?: number): void
    addFromURI(src: string, weight?: number): void
    item(index: number): SpeechGrammar
    [index: number]: SpeechGrammar
  }

  interface SpeechGrammar {
    src: string
    weight: number
  }

  const webkitSpeechRecognition: typeof SpeechRecognition

  interface Window {
    SpeechRecognition?: typeof SpeechRecognition
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

/** Use this type for variables holding a SpeechRecognition instance (avoids "value used as type" when constructor is in scope) */
export type SpeechRecognitionInstance = SpeechRecognition
export type { SpeechRecognitionEvent }

export {}