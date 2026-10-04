'use client';

import { useRouter } from 'next/navigation';
import { createContext, use, useCallback, useMemo, useState } from 'react';
import { LOCALE_COOKIE, type Locale } from './config';
import { en, type Messages } from './messages/en';
import { es } from './messages/es';

const DICTIONARIES: Record<Locale, Messages> = { en, es };
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

interface I18nValue {
  locale: Locale;
  /** The texts, e.g. `t.auth.signIn.title`. */
  t: Messages;
  setLocale(locale: Locale): void;
}

const I18nContext = createContext<I18nValue | null>(null);

/** `locale` comes from the server, so the first paint is already in the right language. */
export function I18nProvider({
  locale: initial,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setCurrent] = useState(initial);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
      document.documentElement.lang = next;
      setCurrent(next);
      // Parts rendered on the server (page titles, static text) follow on the next render.
      router.refresh();
    },
    [router],
  );

  const value = useMemo(
    () => ({ locale, t: DICTIONARIES[locale], setLocale }),
    [locale, setLocale],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
