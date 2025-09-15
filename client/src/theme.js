// Theme configuration for Xpanel
export const theme = {
  colors: {
    primary: '#00D4FF',
    secondary: '#0099CC',
    accent: '#00FF88',
    background: '#0a0a0a',
    backgroundSecondary: '#1a1a2e',
    backgroundTertiary: '#16213e',
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    success: '#00ff88',
    warning: '#ffa502',
    error: '#ff4757',
    info: '#00d4ff'
  },
  
  gradients: {
    primary: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
    secondary: 'linear-gradient(135deg, #0099CC 0%, #00FF88 100%)',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
    card: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
    text: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #00ff88 100%)',
    accent: 'linear-gradient(90deg, #00ff88, #00d4ff)'
  },
  
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    xlarge: '16px',
    round: '50%'
  },
  
  shadows: {
    small: '0 2px 4px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 15px rgba(0, 212, 255, 0.2)',
    large: '0 10px 30px rgba(0, 212, 255, 0.3)',
    glow: '0 0 20px rgba(0, 212, 255, 0.4)'
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem'
  },
  
  typography: {
    fontFamily: {
      primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"Fira Code", "Monaco", "Consolas", monospace'
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem'
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },
  
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060
  }
};

export default theme;
