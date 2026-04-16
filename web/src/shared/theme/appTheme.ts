<<<<<<< HEAD
import { alpha, createTheme } from '@mui/material/styles';
=======
﻿import { alpha, createTheme } from '@mui/material/styles';
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
import { themeTokens } from '@shared/theme/tokens';

const tokens = themeTokens;
const buttonRadius = tokens.shape.buttonRadius;
const panelPadding = tokens.shape.panelPadding;
const surfacePadding = tokens.shape.surfacePadding;

export const appTheme = createTheme({
  acomShape: {
    buttonRadius,
    controlRadius: buttonRadius,
    panelPadding,
    panelRadius: buttonRadius + panelPadding,
    surfacePadding,
    surfaceRadius: buttonRadius + surfacePadding,
  },
<<<<<<< HEAD
=======
  workload: ['#6fa8dc', '#8ecae6', '#a4c2f4', '#f4b183', '#a8d5ba', '#c9b6e4', '#f7c9a9', '#b7d7e8']
};

const tokens = themeTokens;
const buttonRadius = tokens.shape.buttonRadius;
const panelPadding = tokens.shape.panelPadding;
const surfacePadding = tokens.shape.surfacePadding;

export const appTheme = createTheme({
  acomShape: {
    buttonRadius,
    controlRadius: buttonRadius,
    panelPadding,
    panelRadius: buttonRadius + panelPadding,
    surfacePadding,
    surfaceRadius: buttonRadius + surfacePadding
  },
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
  palette: {
    mode: 'light',
    primary: {
      main: tokens.color.primary.main,
      dark: tokens.color.primary.hover,
      light: tokens.color.accent,
<<<<<<< HEAD
      contrastText: tokens.color.background.card,
=======
      contrastText: tokens.color.background.card
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
    },
    secondary: {
      main: '#1f2a44',
    },
    background: {
      default: tokens.color.background.page,
<<<<<<< HEAD
      paper: tokens.color.background.card,
    },
    text: {
      primary: tokens.color.text.primary,
      secondary: tokens.color.text.secondary,
    },
    divider: tokens.color.border,
    success: {
      main: tokens.color.status.success,
    },
    warning: {
      main: tokens.color.status.warning,
    },
    error: {
      main: tokens.color.status.error,
    },
    info: {
      main: tokens.color.status.info,
    },
    brand: {
      accent: tokens.color.accent,
      softSection: tokens.color.background.softSection,
      border: tokens.color.border,
      mutedBadge: tokens.color.status.mutedBadge,
      chart: [...tokens.color.chart],
      disabledBg: tokens.color.disabled.bg,
      disabledText: tokens.color.disabled.text,
      primaryHover: tokens.color.primary.hover,
      primaryPressed: tokens.color.primary.pressed,
    },
    dashboard: {
      status: {
        open: tokens.color.status.open,
        review: tokens.color.status.review,
      },
      workload: [...tokens.color.chart],
    },
  },
  shape: {
    borderRadius: tokens.shape.radius,
=======
      paper: tokens.color.background.card
    },
    text: {
      primary: tokens.color.text.primary,
      secondary: tokens.color.text.secondary
    },
    divider: tokens.color.border,
    success: {
      main: tokens.color.status.success
    },
    warning: {
      main: tokens.color.status.warning
    },
    error: {
      main: tokens.color.status.error
    },
    info: {
      main: tokens.color.status.info
    },
    brand: {
      accent: tokens.color.accent,
      softSection: tokens.color.background.softSection,
      border: tokens.color.border,
      mutedBadge: tokens.color.status.mutedBadge,
      chart: [...tokens.color.chart],
      disabledBg: tokens.color.disabled.bg,
      disabledText: tokens.color.disabled.text,
      primaryHover: tokens.color.primary.hover,
      primaryPressed: tokens.color.primary.pressed
    },
    statusTones: tokens.color.status.tones,
    dashboard: dashboardPalette
  },
  shape: {
    borderRadius: tokens.shape.radius
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
  },
  typography: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.bodyFontSize,
    h1: {
      fontSize: 32,
      fontWeight: 700,
<<<<<<< HEAD
      lineHeight: 1.2,
=======
      lineHeight: 1.2
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
    },
    h2: {
      fontSize: 24,
      fontWeight: 700,
<<<<<<< HEAD
      lineHeight: 1.25,
    },
    body1: {
      fontSize: 16,
      lineHeight: 1.5,
=======
      lineHeight: 1.25
    },
    body1: {
      fontSize: 16,
      lineHeight: 1.5
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
    },
    button: {
      textTransform: 'none',
      fontSize: tokens.typography.buttonFontSize,
      fontWeight: tokens.typography.buttonFontWeight,
<<<<<<< HEAD
      lineHeight: 1.2,
    },
=======
      lineHeight: 1.2
    }
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          minWidth: 320,
          backgroundColor: tokens.color.background.page,
<<<<<<< HEAD
          color: tokens.color.text.primary,
        },
        '*::selection': {
          backgroundColor: alpha(tokens.color.primary.main, 0.2),
        },
      },
=======
          color: tokens.color.text.primary
        },
        '*::selection': {
          backgroundColor: alpha(tokens.color.primary.main, 0.2)
        }
      }
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.color.border}`,
          boxShadow: 'none',
<<<<<<< HEAD
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
=======
          backgroundImage: 'none'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
      },
      styleOverrides: {
        root: {
          minHeight: tokens.button.minHeight,
          borderRadius: buttonRadius,
          paddingLeft: tokens.button.horizontalPadding,
          paddingRight: tokens.button.horizontalPadding,
          gap: 10,
          fontWeight: tokens.typography.buttonFontWeight,
          letterSpacing: 0,
          transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
          '& .MuiButton-startIcon, & .MuiButton-endIcon': {
            margin: 0,
            '& > *:first-of-type': {
<<<<<<< HEAD
              fontSize: tokens.button.iconSize,
            },
          },
        },
        contained: {
          backgroundColor: tokens.color.primary.main,
          color: tokens.color.background.card,
          '&:hover': {
            backgroundColor: tokens.color.primary.hover,
          },
          '&:active': {
            backgroundColor: tokens.color.primary.pressed,
          },
          '&.Mui-disabled': {
            backgroundColor: tokens.color.disabled.bg,
            color: tokens.color.disabled.text,
          },
        },
        outlined: {
          borderWidth: tokens.button.borderWidth,
          borderColor: tokens.color.primary.main,
          color: tokens.color.primary.main,
          '&:hover': {
            borderWidth: tokens.button.borderWidth,
            borderColor: tokens.color.primary.hover,
            color: tokens.color.primary.main,
            backgroundColor: alpha(tokens.color.primary.main, tokens.interaction.outlinedHoverBgAlpha),
          },
          '&:active': {
            borderWidth: tokens.button.borderWidth,
            borderColor: tokens.color.primary.pressed,
            backgroundColor: alpha(tokens.color.primary.main, tokens.interaction.outlinedPressedBgAlpha),
          },
          '&.Mui-disabled': {
            borderWidth: tokens.button.borderWidth,
            borderColor: tokens.color.disabled.text,
            color: tokens.color.disabled.text,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.color.background.card,
          borderRadius: buttonRadius,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.color.border,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.color.primary.main,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.color.primary.main,
            borderWidth: 1.5,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        outlined: {
          borderWidth: 1.5,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: tokens.color.text.primary,
        },
      },
    },
  },
});
=======
              fontSize: tokens.button.iconSize
            }
          }
        },
        contained: {
          backgroundColor: tokens.color.primary.main,
          color: tokens.color.background.card,
          '&:hover': {
            backgroundColor: tokens.color.primary.hover
          },
          '&:active': {
            backgroundColor: tokens.color.primary.pressed
          },
          '&.Mui-disabled': {
            backgroundColor: tokens.color.disabled.bg,
            color: tokens.color.disabled.text
          }
        },
        outlined: {
          borderWidth: tokens.button.borderWidth,
          borderColor: tokens.color.primary.main,
          color: tokens.color.primary.main,
          '&:hover': {
            borderWidth: tokens.button.borderWidth,
            borderColor: tokens.color.primary.hover,
            color: tokens.color.primary.main,
            backgroundColor: alpha(tokens.color.primary.main, tokens.interaction.outlinedHoverBgAlpha)
          },
          '&:active': {
            borderWidth: tokens.button.borderWidth,
            borderColor: tokens.color.primary.pressed,
            backgroundColor: alpha(tokens.color.primary.main, tokens.interaction.outlinedPressedBgAlpha)
          },
          '&.Mui-disabled': {
            borderWidth: tokens.button.borderWidth,
            borderColor: tokens.color.disabled.text,
            color: tokens.color.disabled.text
          }
        }
      }
    }
  }
});
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
