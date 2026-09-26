import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import type { DraftState } from '../api/draft.ts'
import { draftClock, type DraftClock } from '../lib/draftClock.ts'
import { POOL_SIZE } from '../lib/league.ts'

function clockLine(clock: DraftClock): string {
  if (clock.complete) {
    return `Draft complete: ${POOL_SIZE} of ${POOL_SIZE} picks made.`
  }
  const head = `Pick ${clock.nextOverall} of ${POOL_SIZE}, round ${clock.round}: ${clock.team}.`
  if (clock.picksUntilUser == null) return head
  if (clock.picksUntilUser === 0) return `${head} You are on the clock.`
  const away = clock.picksUntilUser === 1 ? '1 pick' : `${clock.picksUntilUser} picks`
  return `${head} Your next pick is #${clock.userNextOverall} (${away} away).`
}

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
  const order = draft?.draft_order ?? []
  const userTeam = draft?.user_team ?? ''
  const clock = draftClock(order, draft?.picks.length ?? 0, userTeam)

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
      {order.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Draft order not published yet. Refresh picks.
        </Typography>
      ) : (
        <>
          <Stack
            component="ul"
            direction="row"
            spacing={1}
            aria-label="Draft order"
            sx={{ flexWrap: 'wrap', listStyle: 'none', m: 0, p: 0 }}
          >
            {order.map((team, index) => {
              const slot = index + 1
              const onClock = clock.slot === slot
              const isUser = team === userTeam
              return (
                <Chip
                  key={`${slot}-${team}`}
                  component="li"
                  size="small"
                  label={`${slot} ${team}`}
                  color={onClock ? 'primary' : 'default'}
                  variant={isUser ? 'outlined' : 'filled'}
                  data-on-clock={onClock ? 'true' : undefined}
                  data-user={isUser ? 'true' : undefined}
                />
              )
            })}
          </Stack>
          <Typography variant="body2">{clockLine(clock)}</Typography>
        </>
      )}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {children}
    </Stack>
  )
}
