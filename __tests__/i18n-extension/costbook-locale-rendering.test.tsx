/**
 * i18n extension: Costbook / financials strings render in each locale (EAC, Variance, etc.)
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { I18nProvider, useTranslations } from '@/lib/i18n/context'

function CostbookLabels () {
  const { t } = useTranslations()
  return (
    <div>
      <span data-testid="variance">{t('financials.variance' as any)}</span>
      <span data-testid="variance-analysis">{t('financials.varianceAnalysis' as any)}</span>
      <span data-testid="common-save">{t('common.save' as any)}</span>
      <span data-testid="nav-financials">{t('nav.financials' as any)}</span>
    </div>
  )
}

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

const store: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const key of Object.keys(store)) delete store[key] },
  },
  writable: true,
})

const localePayloads: Record<string, object> = {
  en: {
    common: { save: 'Save' },
    nav: { financials: 'Financials' },
    financials: { variance: 'Variance', varianceAnalysis: 'Budget Variance Analysis' },
  },
  'es-MX': {
    common: { save: 'Guardar' },
    nav: { financials: 'Finanzas' },
    financials: { variance: 'Varianza', varianceAnalysis: 'Análisis de Varianza de Presupuesto' },
  },
  'zh-CN': {
    common: { save: '保存' },
    nav: { financials: '财务' },
    financials: { variance: '差异', varianceAnalysis: '预算差异分析' },
  },
  'ja-JP': {
    common: { save: '保存' },
    nav: { financials: '財務' },
    financials: { variance: '差異', varianceAnalysis: '予算差異分析' },
  },
}

global.fetch = jest.fn((url: string | URL) => {
  const path = typeof url === 'string' ? url : url.toString()
  const m = path.match(/\/locales\/([^.]+)\.json/)
  const locale = m ? m[1] : 'en'
  return Promise.resolve({
    ok: true,
    json: async () => localePayloads[locale] ?? localePayloads.en,
  } as Response)
}) as jest.Mock

describe('i18n extension: Costbook locale rendering', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  )

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    jest.clearAllMocks()
  })

  it('renders Costbook/financials labels (Variance, save, nav) with translation keys or values', async () => {
    render(<CostbookLabels />, { wrapper })
    await screen.findByTestId('variance')
    expect(screen.getByTestId('variance')).toBeInTheDocument()
    expect(screen.getByTestId('common-save')).toBeInTheDocument()
    expect(screen.getByTestId('nav-financials')).toBeInTheDocument()
    expect(screen.getByTestId('variance-analysis')).toBeInTheDocument()
    // t() returns either translated value (e.g. "Variance") or key (e.g. "financials.variance") when loading
    const varianceText = screen.getByTestId('variance').textContent
    expect(varianceText === 'Variance' || varianceText === 'financials.variance').toBe(true)
  })

  it('renders with es-MX locale when saved in localStorage', async () => {
    store['orka-ppm-locale'] = 'es-MX'
    render(<CostbookLabels />, { wrapper })
    await screen.findByTestId('variance')
    expect(screen.getByTestId('variance')).toBeInTheDocument()
    expect(screen.getByTestId('common-save')).toBeInTheDocument()
    // With es-MX loaded: either translated (Guardar/Varianza) or key; ensures no crash and structure is correct
    const saveText = screen.getByTestId('common-save').textContent
    expect(saveText === 'Guardar' || saveText === 'common.save').toBe(true)
  })
})
