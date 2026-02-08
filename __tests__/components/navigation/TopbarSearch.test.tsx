/**
 * Unit tests for TopbarSearch component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TopbarSearch from '@/components/navigation/TopbarSearch'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockSession = { access_token: 'test-token' }
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({ session: mockSession }),
}))

jest.mock('@/lib/i18n/context', () => {
  const topbarT: Record<string, string> = {
    'topbar.searchPlaceholder': 'Search projects, features, docs…',
    'topbar.searchAria': 'Search',
    'topbar.searching': 'Searching…',
    'topbar.suggestions': 'Suggestions',
    'topbar.noResults': 'No results for "{{query}}"',
    'topbar.voiceSearch': 'Voice search',
    'topbar.listening': 'Listening…',
  }
  const t = (key: string, params?: Record<string, string>) => {
    const s = topbarT[key] ?? key
    return params ? s.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => params[k] ?? '') : s
  }
  return {
    useI18n: () => ({
      t,
      locale: 'en',
      setLocale: jest.fn(),
      isLoading: false,
      translations: {},
    }),
    useTranslations: () => ({ t, locale: 'en', isLoading: false }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

const searchResponse = {
  fulltext: [
    { type: 'project', id: 'p1', title: 'Test Project', snippet: 'A project', href: '/projects/p1' },
  ],
  semantic: [] as any[],
  suggestions: ['Costbook', 'Projects'],
  meta: { role: 'user' },
}

describe('TopbarSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn((url: string) => {
      if (String(url).includes('/api/search')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(searchResponse),
        } as Response)
      }
      return Promise.reject(new Error('Unknown URL'))
    }) as jest.Mock
  })

  it('renders search input with placeholder', () => {
    render(<TopbarSearch />)
    expect(screen.getByPlaceholderText(/Search projects, features, docs/)).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
  })

  it('shows dropdown with results after typing and debounce', async () => {
    render(<TopbarSearch />)
    const input = screen.getByRole('searchbox', { name: 'Search' })
    await act(async () => {
      await userEvent.type(input, 'test')
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350))
    })
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/search'),
          expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
        )
      },
      { timeout: 2000 }
    )
    expect(await screen.findByText('Test Project', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('navigates when result link is clicked', async () => {
    render(<TopbarSearch />)
    const input = screen.getByRole('searchbox', { name: 'Search' })
    await act(async () => {
      await userEvent.type(input, 'test')
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350))
    })
    const link = await screen.findByText('Test Project', {}, { timeout: 3000 })
    fireEvent.click(link)
    expect(mockPush).toHaveBeenCalledWith('/projects/p1')
  })

  it('closes dropdown on Escape', async () => {
    render(<TopbarSearch />)
    const input = screen.getByRole('searchbox', { name: 'Search' })
    await act(async () => {
      await userEvent.type(input, 'test')
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350))
    })
    expect(await screen.findByText('Test Project', {}, { timeout: 3000 })).toBeInTheDocument()
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    await waitFor(() => {
      expect(screen.queryByText('Test Project')).not.toBeInTheDocument()
    })
  })
})
