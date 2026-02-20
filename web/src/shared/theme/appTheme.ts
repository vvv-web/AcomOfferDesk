import { alpha, createTheme } from '@mui/material/styles';

const baseTheme = createTheme({
  palette: {
    mode: 'light',
     primary: {
      main: '#2f6fd6',
      dark: '#245bb5',
      light: '#e7f0ff'
    },
    secondary: {
      main: '#1f2a44'
    },
    background: {
      default: '#edf3ff',
      paper: '#ffffff'
    },
    text: {
      primary: '#1f2a44',
      secondary: '#4a5875'
    },
    divider: '#d3dbe7'
  },
  shape: {
    borderRadius: 16
  },
  typography: {
    fontFamily: ['"Roboto"', '"Helvetica"', '"Arial"', 'sans-serif'].join(',')
  }
});

export const appTheme = createTheme(baseTheme, {
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${baseTheme.palette.divider}`,
          boxShadow: '0 12px 28px rgba(15, 35, 75, 0.08)',
          backgroundImage: 'none'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 999
        },
        outlined: {
          borderColor: baseTheme.palette.primary.main,
          color: baseTheme.palette.primary.main
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: baseTheme.palette.background.paper,
          borderRadius: 14,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: baseTheme.palette.divider
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: baseTheme.palette.primary.main
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: baseTheme.palette.primary.main,
            borderWidth: 1.5
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        outlined: {
          borderWidth: 1.5
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: baseTheme.palette.text.primary
        }
      }
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: baseTheme.palette.background.default
        },
        '*::selection': {
          backgroundColor: alpha(baseTheme.palette.primary.main, 0.2)
        }
      }
    }
  }
});