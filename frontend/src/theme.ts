import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  typography: {
    fontFamily: [
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(', '),
  },
})

export default theme
