import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { DraftPick } from '../api/draft.ts'
import { rosterSummary } from '../lib/draftRoster.ts'
import { POSITIONS, ROSTER_SIZE } from '../lib/league.ts'

/** Past this round an unfilled position is flagged as a hole. */
const HOLE_WARNING_AFTER_ROUND = 5

type DraftRosterSummaryProps = {
  picks: DraftPick[]
  userEspnTeamId: number
  /** Current draft round (1-based), used to decide when an empty position is a hole. */
  round: number
}

export default function DraftRosterSummary({
  picks,
  userEspnTeamId,
  round,
}: DraftRosterSummaryProps) {
  const summary = rosterSummary(picks, userEspnTeamId)
  const flagHoles = round > HOLE_WARNING_AFTER_ROUND

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
    >
      <Stack
        component="ul"
        direction="row"
        spacing={1}
        aria-label="Roster positions"
        sx={{ flexWrap: 'wrap', listStyle: 'none', m: 0, p: 0 }}
      >
        {POSITIONS.map((position) => {
          const count = summary.byPosition[position]
          const hole = flagHoles && count === 0
          return (
            <Chip
              key={position}
              component="li"
              size="small"
              label={`${position} ${count}`}
              color={hole ? 'warning' : 'default'}
              data-hole={hole ? 'true' : undefined}
            />
          )
        })}
      </Stack>
      <Typography variant="body2">
        {`Drafted ${summary.total} / ${ROSTER_SIZE}`}
      </Typography>
    </Stack>
  )
}
