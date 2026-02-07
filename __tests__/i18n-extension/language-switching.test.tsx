/**
 * i18n extension: Language switching (all supported locales including es-MX, zh-CN, hi-IN, ja-JP, ko-KR, vi-VN)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GlobalLanguageSelector } from '@/components/navigation/GlobalLanguageSelector'
import { I18nProvider } from '@/lib/i18n/context'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/types'

jest.mock('@/lib/help-chat/api', () => ({
  helpChatAPI: {
    setUserLanguagePreference: jest.fn(),
    getUserLanguagePreference: jest.fn(),
    getSupportedLanguages: jest.fn(),
    detectLanguage: jest.fn(),
    translateContent: jest.fn(),
    clearTranslationCache: jest.fn(),
  },
}))

const localStorageMock: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageMock[key] ?? null,
    setItem: (key: string, value: string) => { localStorageMock[key] = value },
    removeItem: (key: string) => { delete localStorageMock[key] },
    clear: () => { for (const k of Object.keys(localStorageMock)) delete localStorageMock[k] },
  },
  writable: true,
})

global.fetch = jest.fn((url: string | URL) => {
  const path = typeof url === 'string' ? url : url.toString()
  const match = path.match(/\/locales\/([^.]+)\.json/)
  const locale = match ? match[1] : 'en'
  const translations: Record<string, object> = {
    en: { common: { save: 'Save' }, nav: { dashboards: 'Dashboards' } },
    'es-MX': { common: { save: 'Guardar' }, nav: { dashboards: 'Tableros' } },
    'zh-CN': { common: { save: '保存' }, nav: { dashboards: '仪表板' } },
    'ja-JP': { common: { save: '保存' }, nav: { dashboards: 'ダッシュボード' } },
  }
  return Promise.resolve({
    ok: true,
    json: async () => translations[locale] ?? translations.en,
  } as Response)
}) as jest.Mock

describe('i18n extension: Language switching', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  )

  beforeEach(() => {
    Object.keys(localStorageMock).forEach((k) => delete localStorageMock[k])
    jest.clearAllMocks()
  })

  it('lists all supported locales including es-MX, zh-CN, hi-IN, ja-JP, ko-KR, vi-VN', () => {
    render(<GlobalLanguageSelector variant="topbar" />, { wrapper })
    const trigger = screen.getByTitle(/change language/i)
    expect(trigger).toBeInTheDocument()
    fireEvent.click(trigger)
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code)
    expect(codes).toContain('es-MX')
    expect(codes).toContain('zh-CN')
    expect(codes).toContain('hi-IN')
    expect(codes).toContain('ja-JP')
    expect(codes).toContain('ko-KR')
    expect(codes).toContain('vi-VN')
  })

  it('calls setLocale and sets cookie when selecting a new language', async () => {
    const setCookie = jest.fn()
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
      configurable: true,
    })
    document.cookie = ''
    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    Object.defineProperty(document, 'cookie', {
      get: () => '',
      set: (v: string) => { setCookie(v) },
      configurable: true,
    })

    render(<GlobalLanguageSelector variant="topbar" />, { wrapper })
    fireEvent.click(screen.getByTitle(/change language/i))
    const esMxButton = screen.getByText(/Español \(México\)|es-MX/i)
    fireEvent.click(esMxButton)

    await waitFor(() => {
      expect(setCookie).toHaveBeenCalled()
      expect(setCookie.mock.calls.some((c) => c[0].includes('orka-ppm-locale=es-MX'))).toBe(true)
    })
  })
})
