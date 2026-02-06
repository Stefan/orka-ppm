'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Mic, MicOff, FileText, FolderOpen, BookOpen, DollarSign } from 'lucide-react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'

const DEBOUNCE_MS = 300
const MAX_RESULTS = 10

export interface SearchResultItem {
  type: string
  id: string
  title: string
  snippet: string
  href: string
  score?: number
  metadata?: Record<string, unknown>
}

export interface SearchResponse {
  fulltext: SearchResultItem[]
  semantic: SearchResultItem[]
  suggestions: string[]
  meta?: { role?: string }
}

function getIconForType(type: string) {
  switch ((type || '').toLowerCase()) {
    case 'project':
      return FolderOpen
    case 'commitment':
      return DollarSign
    case 'knowledge_base':
    case 'document':
      return BookOpen
    default:
      return FileText
  }
}

export default function TopbarSearch() {
  const { session } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResponse | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults(null)
        return
      }
      const token = session?.access_token
      if (!token) {
        setResults({ fulltext: [], semantic: [], suggestions: [] })
        return
      }
      setLoading(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=${MAX_RESULTS}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        if (res.ok) {
          const data: SearchResponse = await res.json()
          setResults(data)
          setOpen(true)
        } else {
          setResults({ fulltext: [], semantic: [], suggestions: [] })
        }
      } catch {
        setResults({ fulltext: [], semantic: [], suggestions: [] })
      } finally {
        setLoading(false)
      }
    },
    [session?.access_token]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults(null)
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      fetchSearch(query)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    setVoiceSupported(ok)
  }, [])

  const startVoice = useCallback(() => {
    if (!voiceSupported) return
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognition) return
    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'de-DE'
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? ''
      if (transcript) {
        setQuery(transcript)
        fetchSearch(transcript)
      }
    }
    rec.start()
  }, [voiceSupported, fetchSearch])

  const allItems: SearchResultItem[] = [
    ...(results?.fulltext ?? []),
    ...(results?.semantic ?? []),
  ].slice(0, MAX_RESULTS)

  const hasSuggestions = (results?.suggestions?.length ?? 0) > 0
  const showDropdown = open && (allItems.length > 0 || hasSuggestions || loading)

  const handleSelectResult = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-2 md:mx-4">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          placeholder="Suche Projekte, Features, Docs…"
          className="w-full md:w-96 pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 focus:shadow outline-none transition-all"
          aria-label="Search"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={startVoice}
            disabled={listening}
            className="absolute right-2 p-1.5 rounded-md text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
            aria-label={listening ? 'Listening…' : 'Voice search'}
          >
            {listening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-y-auto max-h-96 z-[10000]"
          role="listbox"
        >
          {loading && (
            <div className="p-4 text-sm text-gray-500 dark:text-slate-400">
              Suche…
            </div>
          )}
          {!loading && allItems.length > 0 && (
            <ul className="py-2">
              {allItems.map((item) => {
                const Icon = getIconForType(item.type)
                return (
                  <li key={`${item.type}-${item.id}`}>
                    <Link
                      href={item.href}
                      onClick={(e) => {
                        e.preventDefault()
                        handleSelectResult(item.href)
                      }}
                      className="flex gap-2 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
                      role="option"
                    >
                      <Icon className="h-5 w-5 text-gray-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 dark:text-slate-100 truncate">
                          {item.title}
                        </div>
                        {item.snippet && (
                          <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                            {item.snippet}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {!loading && hasSuggestions && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700">
              <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
                Vorschläge
              </div>
              <div className="flex flex-wrap gap-1">
                {(results?.suggestions ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setQuery(s)
                      fetchSearch(s)
                    }}
                    className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-slate-200 hover:bg-blue-100 dark:hover:bg-slate-500"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!loading && allItems.length === 0 && !hasSuggestions && query.trim() && (
            <div className="p-4 text-sm text-gray-500 dark:text-slate-400">
              Keine Treffer für „{query}“
            </div>
          )}
        </div>
      )}
    </div>
  )
}
