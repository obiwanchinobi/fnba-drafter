import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { expect, test, vi } from 'vitest'
import type { ReactElement } from 'react'
import theme from '../theme.ts'
import ProjectionsToolbar from './ProjectionsToolbar.tsx'

function renderToolbar(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

test('renders a Source select that includes ESPN', () => {
  renderToolbar(
    <ProjectionsToolbar source="espn" onSourceChange={() => {}} />,
  )

  expect(screen.getByRole('combobox', { name: /source/i })).toBeInTheDocument()
  expect(screen.getByText(/Source:\s*ESPN/)).toBeInTheDocument()

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /source/i }))

  expect(screen.getByRole('option', { name: 'ESPN' })).toBeInTheDocument()
})

test('changing the source select calls onSourceChange', () => {
  const onSourceChange = vi.fn()

  renderToolbar(
    <ProjectionsToolbar source="" onSourceChange={onSourceChange} />,
  )

  fireEvent.mouseDown(screen.getByRole('combobox', { name: /source/i }))
  fireEvent.click(screen.getByRole('option', { name: 'ESPN' }))

  expect(onSourceChange).toHaveBeenCalledWith('espn')
})
