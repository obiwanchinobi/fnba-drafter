import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { fetchStatus, type StatusResponse } from './api/status.ts'

function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchStatus()
      .then((data) => {
        if (!cancelled) {
          setStatus(data)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load status')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        FNBA Drafter
      </Typography>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : status ? (
        <Typography>{status.app}</Typography>
      ) : (
        <Typography>Loading status…</Typography>
      )}
    </Container>
  )
}

export default App
