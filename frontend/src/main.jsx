import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import './index.css';

// 现代、大气、简洁的主题
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { 
      main: '#00BFA5', // 现代的青绿色，契合健康饮食
      light: '#33D8C2',
      dark: '#008573',
      contrastText: '#fff'
    },
    secondary: { 
      main: '#4F46E5', // 靛蓝色，用于强调
      light: '#818CF8',
      dark: '#3730A3',
      contrastText: '#fff'
    },
    background: { 
      default: '#F8FAFC', // 极简灰白背景
      paper: '#FFFFFF' 
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B'
    },
    divider: '#E2E8F0'
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  shape: { 
    borderRadius: 16 // 更大圆角，现代感更强
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '8px 24px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }
        },
        contained: {
          '&:hover': {
            boxShadow: '0 4px 14px rgba(0, 191, 165, 0.4)'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(226, 232, 240, 0.8)'
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
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