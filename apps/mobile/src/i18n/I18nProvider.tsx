import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { catalogs, type Language, type StringKey } from './strings';

const STORAGE_KEY = 'maya.language';

export type Translate = (
  key: StringKey,
  vars?: Record<string, string | number>,
) => string;

type I18nContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const useI18n = (): I18nContextValue => {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
};

/** Just the translate function — the common case at a call site. */
export const useT = (): Translate => useI18n().t;

/**
 * The device language, read without pulling in expo-localization.
 *
 * Indonesian reports as `id` on Android and, on iOS, historically as the
 * deprecated `in` — both are checked. Anything else falls back to English.
 */
const deviceLanguage = (): Language => {
  const raw =
    Platform.OS === 'ios'
      ? (NativeModules.SettingsManager?.settings?.AppleLocale as string | undefined) ??
        (NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] as string | undefined)
      : (NativeModules.I18nManager?.localeIdentifier as string | undefined);

  const tag = (raw ?? 'en').toLowerCase();
  return tag.startsWith('id') || tag.startsWith('in') ? 'id' : 'en';
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(deviceLanguage);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'id') setLanguageState(stored);
    });
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => {
      const template = catalogs[language][key];
      if (!vars) return template;
      return Object.entries(vars).reduce(
        (out, [name, value]) => out.split(`{${name}}`).join(String(value)),
        template,
      );
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  // Unkeyed for the same reason as ThemeProvider: screens consume this context
  // via useT(), and their re-render cascades to everything they render.
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
