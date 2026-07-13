import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadTheme as readTheme, saveTheme as writeTheme } from '@/lib/storage-service';

export type Theme = 'light' | 'dark';

type ThemeColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  success: string;
  successLight: string;
  error: string;
  errorLight: string;
  warning: string;
  warningLight: string;
  info: string;
  infoLight: string;
  shadow: string;
  overlay: string;
  input: string;
  inputBorder: string;
  placeholder: string;
  disabled: string;
  divider: string;
};

const lightTheme: ThemeColors = {
  primary: '#0066ff',
  primaryDark: '#0052cc',
  primaryLight: '#3385ff',
  secondary: '#00d4ff',
  accent: '#ff00e5',
  background: '#f0f4f8',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#0a1929',
  textSecondary: '#2d3748',
  textTertiary: '#64748b',
  border: '#cbd5e1',
  borderLight: '#e2e8f0',
  success: '#00c853',
  successLight: '#e8f5e9',
  error: '#ff1744',
  errorLight: '#ffebee',
  warning: '#ffa726',
  warningLight: '#fff3e0',
  info: '#00d4ff',
  infoLight: '#e1f5fe',
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  input: '#ffffff',
  inputBorder: '#cbd5e1',
  placeholder: '#94a3b8',
  disabled: '#e2e8f0',
  divider: '#e2e8f0',
};

const darkTheme: ThemeColors = {
  primary: '#00d4ff',
  primaryDark: '#00b8e6',
  primaryLight: '#33ddff',
  secondary: '#0066ff',
  accent: '#ff00e5',
  background: '#0a0e17',
  surface: '#151b2b',
  card: '#1a2332',
  text: '#e8eef5',
  textSecondary: '#b8c5d6',
  textTertiary: '#8296b0',
  border: '#2d3748',
  borderLight: '#374151',
  success: '#00ff88',
  successLight: '#1a2e23',
  error: '#ff3366',
  errorLight: '#2e1a1f',
  warning: '#ffaa00',
  warningLight: '#2e2519',
  info: '#00d4ff',
  infoLight: '#1a2833',
  shadow: 'rgba(0, 0, 0, 0.5)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  input: '#1a2332',
  inputBorder: '#2d3748',
  placeholder: '#64748b',
  disabled: '#2d3748',
  divider: '#2d3748',
};

type ThemeContextType = {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = () => {
    const saved = readTheme() as Theme | null;
    if (saved) setThemeState(saved);
  };

  const saveTheme = (newTheme: Theme) => {
    writeTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    saveTheme(newTheme);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    saveTheme(newTheme);
  };

  const colors = theme === 'light' ? lightTheme : darkTheme;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
