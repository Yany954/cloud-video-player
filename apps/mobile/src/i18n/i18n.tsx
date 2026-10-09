import { getLocales } from 'expo-localization';
import { createContext, use, useMemo } from 'react';
import { en, type Messages } from './messages/en';
import { es } from './messages/es';

export type Locale = 'en' | 'es';

const MESSAGES: Record<Locale, Messages> = { en, es };

/** Spanish for a phone set to any kind of Spanish; English for everything else. */
export function pickLocale(languageCodes: readonly (string | null)[]): Locale {
  for (const code of languageCodes) {
    if (code === 'es') return 'es';
    if (code === 'en') return 'en';
  }
  return 'en';
}

const I18nContext = createContext<{ locale: Locale; t: Messages } | null>(null);

/** The app follows the phone's language list (Settings > General > Language & Region). */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => {
    const locale = pickLocale(getLocales().map((item) => item.languageCode));
    return { locale, t: MESSAGES[locale] };
  }, []);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
