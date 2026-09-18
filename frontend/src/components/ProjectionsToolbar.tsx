import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

const PROJECTION_SOURCES = ['espn'] as const

const SOURCE_LABELS: Record<string, string> = {
  espn: 'ESPN',
}

type ProjectionsToolbarProps = {
  source: string
  onSourceChange: (source: string) => void
}

export default function ProjectionsToolbar({
  source,
  onSourceChange,
}: ProjectionsToolbarProps) {
  const sourceLabel = SOURCE_LABELS[source] ?? source

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
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
    </Stack>
  )
}
