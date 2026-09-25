import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router'
import MockDraftsPage from './pages/MockDraftsPage.tsx'
import ProjectionsPage from './pages/ProjectionsPage.tsx'
import WinningWeightsPage from './pages/WinningWeightsPage.tsx'

type Section = 'projections' | 'mock_drafts' | 'winning_weights'

function App() {
  const { pathname } = useLocation()
  const section: Section = pathname.startsWith('/mock-drafts')
    ? 'mock_drafts'
    : pathname.startsWith('/winning-weights')
      ? 'winning_weights'
      : 'projections'

  return (
    <>
      <Box sx={{ px: 2, pt: 2 }}>
        <Tabs value={section} aria-label="FNBA sections">
          <Tab
            value="projections"
            label="Projections"
            component={Link}
            to="/projections"
          />
          <Tab
            value="mock_drafts"
            label="Mock drafts"
            component={Link}
            to="/mock-drafts"
          />
          <Tab
            value="winning_weights"
            label="Winning weights"
            component={Link}
            to="/winning-weights"
          />
        </Tabs>
      </Box>
      <Routes>
        <Route path="/" element={<Navigate to="/projections" replace />} />
        <Route path="/projections" element={<ProjectionsPage />} />
        <Route path="/mock-drafts" element={<MockDraftsPage />} />
        <Route path="/mock-drafts/:id" element={<MockDraftsPage />} />
        <Route path="/winning-weights" element={<WinningWeightsPage />} />
        <Route path="*" element={<Navigate to="/projections" replace />} />
      </Routes>
    </>
  )
}

export default App
