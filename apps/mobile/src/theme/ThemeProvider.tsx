import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getActivePalette, setActiveScheme } from './active';
import type { ColorScheme, Palette } from './palettes';

/** What the user chose. `system` follows the OS and is the default. */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'maya.theme.preference';

type ThemeContextValue = {
  /** The scheme actually in effect, after resolving `system`. */
  scheme: ColorScheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = (): ThemeContextValue => {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  // Set DURING render, not in an effect. Children read `colors` while rendering,
  // so an effect would run a frame too late and paint one frame of the old
  // palette on every change.
  setActiveScheme(scheme);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, colors: getActivePalette(), preference, setPreference }),
    [scheme, preference, setPreference],
  );

  // No `key` here, deliberately. Remounting the tree would repaint correctly
  // but reset the navigator, so changing the theme from Profile would bounce
  // the user to Discover. Instead every SCREEN calls useTheme() — a screen
  // re-render recreates its child elements, so the whole subtree re-renders and
  // re-reads the lazily-resolved stylesheets (see active.ts) without anything
  // unmounting.
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
