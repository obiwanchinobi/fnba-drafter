import { useState } from 'react'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import MockDraftsPage from './pages/MockDraftsPage.tsx'
import ProjectionsPage from './pages/ProjectionsPage.tsx'

type Section = 'projections' | 'mock_drafts'

function App() {
  const [section, setSection] = useState<Section>('projections')

  return (
    <>
      <Box sx={{ px: 2, pt: 2 }}>
        <Tabs
          value={section}
          onChange={(_event, value: Section) => setSection(value)}
          aria-label="FNBA sections"
        >
          <Tab value="projections" label="Projections" />
          <Tab value="mock_drafts" label="Mock drafts" />
        </Tabs>
      </Box>
      {section === 'projections' ? <ProjectionsPage /> : <MockDraftsPage />}
    </>
  )
}

export default App
