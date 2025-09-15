import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import styled, { createGlobalStyle, ThemeProvider } from 'styled-components';
import { Toaster } from 'react-hot-toast';

// Components
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import LoadingScreen from './components/LoadingScreen';

// Theme
const theme = {
  colors: {
    primary: '#00D4FF',
    secondary: '#1a1a2e',
    background: '#0a0a0a',
    surface: '#1e1e2e',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    success: '#00ff88',
    error: '#ff4757',
    warning: '#ffa502'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #00D4FF 0%, #0099cc 100%)',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
    card: 'linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%)'
  },
  shadows: {
    small: '0 2px 8px rgba(0, 0, 0, 0.3)',
    medium: '0 4px 16px rgba(0, 0, 0, 0.4)',
    large: '0 8px 32px rgba(0, 0, 0, 0.5)'
  },
  borderRadius: {
    small: '8px',
    medium: '12px',
    large: '16px'
  }
};

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${props => props.theme.gradients.background};
    color: ${props => props.theme.colors.text};
    overflow-x: hidden;
  }

  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.colors.secondary};
  }

  ::-webkit-scrollbar-thumb {
    background: ${props => props.theme.colors.primary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #0099cc;
  }
`;

const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing token
    const token = localStorage.getItem('xpanel_token');
    const userData = localStorage.getItem('xpanel_user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('xpanel_token');
        localStorage.removeItem('xpanel_user');
      }
    }
    
    setTimeout(() => setLoading(false), 1500);
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('xpanel_token', token);
    localStorage.setItem('xpanel_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('xpanel_token');
    localStorage.removeItem('xpanel_user');
  };

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <LoadingScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AppContainer>
        <Router>
          <Routes>
            <Route 
              path="/" 
              element={
                isAuthenticated ? 
                <Navigate to="/dashboard" replace /> : 
                <LandingPage />
              } 
            />
            <Route 
              path="/auth" 
              element={
                isAuthenticated ? 
                <Navigate to="/dashboard" replace /> : 
                <Auth onLogin={handleLogin} />
              } 
            />
            <Route 
              path="/dashboard/*" 
              element={
                isAuthenticated ? 
                <Dashboard user={user} onLogout={handleLogout} /> : 
                <Navigate to="/" replace />
              } 
            />
          </Routes>
        </Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: theme.colors.surface,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.primary}`,
            },
          }}
        />
      </AppContainer>
    </ThemeProvider>
  );
}

export default App;
