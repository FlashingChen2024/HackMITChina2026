import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import './index.css';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#000000', contrastText: '#ffffff' },
    secondary: { main: '#f4f4f5', contrastText: '#000000' },
    error: { main: '#ff3333' },
    background: { default: '#ffffff', paper: '#ffffff' },
    text: { primary: '#000000', secondary: '#52525b' }
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
    h3: { fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase' },
    h4: { fontWeight: 900, letterSpacing: '-0.04em' },
    h5: { fontWeight: 800, letterSpacing: '-0.02em' },
    h6: { fontWeight: 800, letterSpacing: '-0.02em' },
    subtitle1: { fontWeight: 800, letterSpacing: '-0.01em' },
    button: { textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { 
          borderRadius: 0, 
          padding: '12px 24px', 
          border: '2px solid #000',
          boxShadow: '4px 4px 0px #000',
          transition: 'all 0.1s ease',
          '&:hover': { 
            boxShadow: '2px 2px 0px #000',
            transform: 'translate(2px, 2px)'
          },
          '&:disabled': {
            border: '2px solid #a1a1aa',
            boxShadow: 'none',
            transform: 'none'
          }
        },
        containedPrimary: {
          backgroundColor: '#000',
          color: '#fff',
          '&:hover': { backgroundColor: '#000' }
        },
        outlined: {
          backgroundColor: '#fff',
          color: '#000',
          '&:hover': { backgroundColor: '#f4f4f5' }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: { 
          borderRadius: 0, 
          border: '2px solid #000',
          boxShadow: '4px 4px 0px #000'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#ffffff', borderBottom: '2px solid #000', color: '#000000', boxShadow: 'none' }
      }
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: { height: 64, backgroundColor: '#ffffff', borderTop: '2px solid #000' }
      }
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: { minWidth: 'auto', padding: '6px 0', '&.Mui-selected': { color: '#000000' }, color: '#a1a1aa' },
        label: { fontSize: '0.75rem', fontWeight: 600, '&.Mui-selected': { fontSize: '0.75rem', fontWeight: 800 } }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            backgroundColor: '#fff',
            '& fieldset': { border: '2px solid #000' },
            '&:hover fieldset': { border: '2px solid #000' },
            '&.Mui-focused fieldset': { border: '2px solid #000' },
          }
        }
      }
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);