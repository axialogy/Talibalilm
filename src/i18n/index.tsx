import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { en, type TranslationKey } from './en';

export type Locale = 'en' | 'ar';

const LOCALE_KEY = 'gg-locale';

/**
 * English (the default) ships in the main bundle. Arabic is fetched the first
 * time a visitor switches to it, so it never weighs down the initial load.
 */
const dicts: Partial<Record<Locale, Record<TranslationKey, string>>> = { en };

interface I18nContextType {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  dir: 'ltr',
  t: key => en[key] || key,
  setLocale: () => {},
});

function applyDocumentLocale(locale: Locale) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
}

/** The saved choice, read before first paint so Arabic never flashes English. */
function savedLocale(): Locale {
  try {
    return localStorage.getItem(LOCALE_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(savedLocale);
  // Bumped when a dictionary finishes loading, to re-render with new strings.
  const [, setDictVersion] = useState(0);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const ensureDict = useCallback((loc: Locale) => {
    if (loc === 'en' || dicts[loc]) return;
    void import('./ar').then(m => {
      dicts.ar = m.ar;
      setDictVersion(v => v + 1);
    });
  }, []);

  // Fetch the dictionary for whatever locale was restored, and mirror the
  // choice onto <html lang/dir>.
  useEffect(() => {
    ensureDict(locale);
    applyDocumentLocale(locale);
  }, [locale, ensureDict]);

  const setLocale = useCallback(
    (next: Locale) => {
      ensureDict(next);
      setLocaleState(next);
      try {
        localStorage.setItem(LOCALE_KEY, next);
      } catch {
        /* storage unavailable */
      }
    },
    [ensureDict],
  );

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      // Fall back to English until the requested dictionary has loaded.
      let text: string = dicts[locale]?.[key] ?? en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale],
  );

  return <I18nContext.Provider value={{ locale, dir, t, setLocale }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export type { TranslationKey };
