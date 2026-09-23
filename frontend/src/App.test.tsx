import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import theme from './theme.ts'
import App from './App.tsx'

function renderApp(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('renders the projections page as the home screen', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  })
  vi.stubGlobal('fetch', fetchMock)

  renderApp(<App />)

  expect(
    await screen.findByRole('heading', { name: '2026–27 projections' }),
  ).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/projections?source=espn&season=2027',
  )
})

test('opens the mock drafts page from the tab', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }),
  )

  renderApp(<App />)
  fireEvent.click(screen.getByRole('tab', { name: 'Mock drafts' }))

  expect(
    await screen.findByRole('heading', { name: 'Mock drafts' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: '2026–27 projections' }),
  ).not.toBeInTheDocument()
})

test('renders an error when the projections request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('Failed to load projections')),
  )

  renderApp(<App />)

  expect(await screen.findByText('Failed to load projections')).toBeInTheDocument()
})
