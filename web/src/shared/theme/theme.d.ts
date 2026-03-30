import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    dashboard: {
      status: {
        open: string;
        review: string;
      };
      workload: string[];
    };
  }

  interface PaletteOptions {
    dashboard?: {
      status?: {
        open?: string;
        review?: string;
      };
      workload?: string[];
    };
  }
}