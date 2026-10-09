import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [] }));

const { pickLocale } = await import('./i18n');
const { en } = await import('./messages/en');
const { es } = await import('./messages/es');

describe('pickLocale', () => {
  it('follows the first language of the phone that the app has', () => {
    expect(pickLocale(['es', 'en'])).toBe('es');
    expect(pickLocale(['fr', 'es'])).toBe('es');
    expect(pickLocale(['en', 'es'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(pickLocale(['fr', null])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });
});

describe('messages', () => {
  const keysOf = (value: object, prefix = ''): string[] =>
    Object.entries(value).flatMap(([key, inner]) =>
      typeof inner === 'object' ? keysOf(inner as object, `${prefix}${key}.`) : [`${prefix}${key}`],
    );

  it('has every text in both languages', () => {
    expect(keysOf(es).sort()).toEqual(keysOf(en).sort());
  });
});
