import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

const PROJECTION_SOURCES = ['espn'] as const

const SOURCE_LABELS: Record<string, string> = {
  espn: 'ESPN',
}

export const POSITION_FILTERS = [
  'All',
  'PG',
  'SG',
  'SF',
  'PF',
  'C',
  'G',
  'F/C',
] as const

export type PositionFilter = (typeof POSITION_FILTERS)[number]

export const ESPN_NBA_TEAMS = [
  'ATL',
  'BOS',
  'NO',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GS',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MIA',
  'MIL',
  'MIN',
  'BKN',
  'NY',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SA',
  'OKC',
  'UTAH',
  'WSH',
  'TOR',
  'MEM',
  'CHA',
  'FA',
] as const

function nbaTeamOptions(extraTeams: string[]): string[] {
  const seen = new Set<string>(ESPN_NBA_TEAMS)
  const extras = extraTeams
    .filter((team) => team && !seen.has(team))
    .sort((a, b) => a.localeCompare(b))
  return [...ESPN_NBA_TEAMS, ...extras]
}

type ProjectionsToolbarProps = {
  source: string
  onSourceChange: (source: string) => void
  search: string
  onSearchChange: (search: string) => void
  position: PositionFilter
  onPositionChange: (position: PositionFilter) => void
  teams: string[]
  onTeamsChange: (teams: string[]) => void
  extraTeams?: string[]
  onUpdateFromSource?: () => void
  updating?: boolean
}

export default function ProjectionsToolbar({
  source,
  onSourceChange,
  search,
  onSearchChange,
  position,
  onPositionChange,
  teams,
  onTeamsChange,
  extraTeams = [],
  onUpdateFromSource,
  updating = false,
}: ProjectionsToolbarProps) {
  const sourceLabel = SOURCE_LABELS[source] ?? source
  const teamOptions = nbaTeamOptions(extraTeams)

  return (
    <Stack
      direction="row"
      spacing={2}
      useFlexGap
      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
    >
      <Typography component="p">{`Source: ${sourceLabel}`}</Typography>
      <FormControl size="small">
        <InputLabel id="projections-source-label">Source</InputLabel>
        <Select
          labelId="projections-source-label"
          id="projections-source"
          label="Source"
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
        >
          {PROJECTION_SOURCES.map((value) => (
            <MenuItem key={value} value={value}>
              {SOURCE_LABELS[value]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        size="small"
        id="projections-search"
        label="Player name"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        sx={{ minWidth: 220 }}
      />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={position}
        onChange={(_event, value: PositionFilter | null) => {
          if (value != null) onPositionChange(value)
        }}
        aria-label="Position"
      >
        {POSITION_FILTERS.map((chip) => (
          <ToggleButton key={chip} value={chip} aria-label={chip}>
            {chip}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="projections-team-label">NBA team</InputLabel>
        <Select
          labelId="projections-team-label"
          id="projections-team"
          multiple
          displayEmpty
          label="NBA team"
          value={teams}
          onChange={(event) => {
            const value = event.target.value
            onTeamsChange(typeof value === 'string' ? value.split(',') : value)
          }}
          renderValue={(selected) =>
            selected.length === 0 ? 'All' : selected.join(', ')
          }
        >
          {teamOptions.map((abbrev) => (
            <MenuItem key={abbrev} value={abbrev}>
              {abbrev}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        size="small"
        onClick={onUpdateFromSource}
        disabled={updating}
        loading={updating}
      >
        Update from source
      </Button>
    </Stack>
  )
}
