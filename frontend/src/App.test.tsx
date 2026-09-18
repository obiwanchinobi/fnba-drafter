import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App.tsx'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('renders the app name from /api/status', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ app: 'fnba-drafter', ok: true }),
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)

  expect(await screen.findByText('fnba-drafter')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith('/api/status')
})

test('renders an error when the status request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('Failed to load status')),
  )

  render(<App />)

  expect(await screen.findByText('Failed to load status')).toBeInTheDocument()
})
