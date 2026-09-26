import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import type { DraftState } from '../api/draft.ts'

type DraftPanelProps = {
  draft: DraftState | null
  refreshing: boolean
  error: string | null
  onRefresh: () => void
  hideDrafted: boolean
  onHideDraftedChange: (hide: boolean) => void
  children?: ReactNode
}

export default function DraftPanel({
  draft,
  refreshing,
  error,
  onRefresh,
  hideDrafted,
  onHideDraftedChange,
  children,
}: DraftPanelProps) {
  const refreshedAt = draft?.refreshed_at ?? null

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Button variant="contained" loading={refreshing} onClick={onRefresh}>
          Refresh picks
        </Button>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={hideDrafted}
              onChange={(_event, checked) => onHideDraftedChange(checked)}
            />
          }
          label="Hide drafted"
        />
        <Typography variant="body2" color="text.secondary">
          {refreshedAt
            ? `Last refreshed ${new Date(refreshedAt).toLocaleString()}`
            : 'Not refreshed yet'}
        </Typography>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {children}
    </Stack>
  )
}
