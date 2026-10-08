'use client';

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('apc-theme-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('apc-theme-change', callback);
  };
}

function getThemeSnapshot(): Theme {
  const saved = localStorage.getItem('apc-theme');
  return isTheme(saved) ? saved : 'system';
}

function getServerThemeSnapshot(): Theme {
  return 'system';
}

function saveTheme(theme: Theme) {
  localStorage.setItem('apc-theme', theme);
  window.dispatchEvent(new Event('apc-theme-change'));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    };
    applyTheme();
    if (theme === 'system') media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme: saveTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider missing');
  return context;
}
