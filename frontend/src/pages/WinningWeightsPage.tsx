import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { runWeightSearch, type WeightSearch } from '../api/weightSearches.ts'
import WeightSearchResults from '../components/WeightSearchResults.tsx'

const USER_TEAM = 'Team Chino'

export default function WinningWeightsPage() {
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<WeightSearch | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFindWeights() {
    setSearching(true)
    setError(null)
    try {
      setResult(await runWeightSearch())
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to find winning weights',
      )
    } finally {
      setSearching(false)
    }
  }

  return (
    <Container component="main" maxWidth={false} sx={{ py: 4, maxWidth: 1536 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Winning weights
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Find winning weights searches weight collections per draft slot for{' '}
          {USER_TEAM} on FNBA Total-Z season totals, and saves the best one for
          each slot as &quot;Draft slot N&quot;. Those collections appear in the
          Weights list on Mock drafts, so you can test any of them across every
          slot.
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={() => void handleFindWeights()}
            disabled={searching}
            loading={searching}
          >
            Find winning weights
          </Button>
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {result ? (
          <WeightSearchResults result={result} userTeam={USER_TEAM} />
        ) : searching ? null : (
          <Typography>No winning weights yet.</Typography>
        )}
      </Stack>
    </Container>
  )
}
