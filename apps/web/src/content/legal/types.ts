import type { Locale } from '@/lib/i18n/config';

/** Where people can write to the people behind the app. Public on purpose. */
export const CONTACT_EMAIL = 'cloudvideoplayer.contact@gmail.com';

/** The day these documents last changed, shown on each of them. */
export const LEGAL_UPDATED = '2026-10-04';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  /** A bulleted list, shown after the paragraphs. */
  items?: string[];
  /** Paragraphs shown after the list. */
  closing?: string[];
}

export interface LegalDocument {
  title: string;
  /** For search engines and link previews. */
  description: string;
  intro: string[];
  sections: LegalSection[];
}

export type LocalizedDocument = Record<Locale, LegalDocument>;
