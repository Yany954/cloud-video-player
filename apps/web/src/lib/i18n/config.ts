// The two languages of the web app. English is the source; Spanish is neutral Latin American.

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Remembers the visitor's choice. A preference they set themselves, not tracking. */
export const LOCALE_COOKIE = 'cvp.lang';

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The visitor's explicit choice if they made one; otherwise the first language their browser
 * asks for that we have ("es-CO,es;q=0.9,en;q=0.8" -> "es"); otherwise English.
 */
export function pickLocale(cookieValue: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const quality = params.find((param) => param.trim().startsWith('q='));
      return {
        language: tag.toLowerCase().split('-')[0],
        q: quality ? Number(quality.split('=')[1]) : 1,
      };
    })
    .filter((entry) => entry.language && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);
  for (const { language } of wanted) if (isLocale(language)) return language;
  return DEFAULT_LOCALE;
}
