import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import theme from './theme.ts'
import App from './App.tsx'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderApp(ui: ReactElement, initialEntries: string[] = ['/']) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
  )
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
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/projections$/)
  expect(screen.getByRole('tab', { name: 'Projections' })).toHaveAttribute(
    'href',
    '/projections',
  )
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/projections?source=espn&season=2027',
  )
})

test('renders projections at /projections with that tab selected', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }),
  )

  renderApp(<App />, ['/projections'])

  expect(
    await screen.findByRole('heading', { name: '2026–27 projections' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Projections' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByRole('tab', { name: 'Mock drafts' })).toHaveAttribute(
    'aria-selected',
    'false',
  )
  expect(screen.getByRole('tab', { name: 'Projections' })).toHaveAttribute(
    'href',
    '/projections',
  )
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/projections$/)
})

test('unknown paths redirect to /projections', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }),
  )

  renderApp(<App />, ['/not-a-page'])

  expect(
    await screen.findByRole('heading', { name: '2026–27 projections' }),
  ).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/projections$/)
  expect(screen.getByRole('tab', { name: 'Projections' })).toHaveAttribute(
    'aria-selected',
    'true',
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
  await waitFor(() => {
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/mock-drafts$/)
  })
  expect(screen.getByRole('tab', { name: 'Mock drafts' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('renders mock drafts at /mock-drafts with that tab selected', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }),
  )

  renderApp(<App />, ['/mock-drafts'])

  expect(
    await screen.findByRole('heading', { name: 'Mock drafts' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Mock drafts' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByRole('tab', { name: 'Projections' })).toHaveAttribute(
    'aria-selected',
    'false',
  )
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/mock-drafts$/)
})

test('renders an error when the projections request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('Failed to load projections')),
  )

  renderApp(<App />)

  expect(await screen.findByText('Failed to load projections')).toBeInTheDocument()
})
