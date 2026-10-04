import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, pickLocale, type Locale } from './config';
import { en, type Messages } from './messages/en';
import { es } from './messages/es';

const DICTIONARIES: Record<Locale, Messages> = { en, es };

/** The language for this request: the visitor's choice, else what their browser asks for. */
export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return pickLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get('accept-language'));
}

export function messagesFor(locale: Locale): Messages {
  return DICTIONARIES[locale];
}
