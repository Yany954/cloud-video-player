'use client';

import { Languages } from 'lucide-react';
import { isLocale, LOCALE_NAMES, LOCALES } from '@/lib/i18n/config';
import { useI18n } from '@/lib/i18n/i18n-context';

/** A native select: it works with every keyboard, screen reader and phone. */
export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="border-input bg-background text-foreground focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 relative flex h-8 items-center gap-1.5 rounded-lg border px-2 text-sm focus-within:ring-3">
      <Languages aria-hidden className="size-4 shrink-0" />
      <span className="sr-only">{t.language.label}</span>
      <select
        name="language"
        value={locale}
        onChange={(change) => isLocale(change.target.value) && setLocale(change.target.value)}
        className="bg-background text-foreground dark:bg-transparent cursor-pointer appearance-none pr-1 outline-none"
      >
        {LOCALES.map((code) => (
          // Each language is named in itself, so its speakers recognise it.
          <option key={code} value={code} lang={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
