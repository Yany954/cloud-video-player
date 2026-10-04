import { describe, expect, it } from 'vitest';
import { pickLocale } from './config';
import { en } from './messages/en';
import { es } from './messages/es';

describe('pickLocale', () => {
  it('keeps the visitor’s own choice over what the browser asks for', () => {
    expect(pickLocale('en', 'es-CO,es;q=0.9')).toBe('en');
    expect(pickLocale('es', 'en-US')).toBe('es');
  });

  it('uses the browser’s preferred language on a first visit', () => {
    expect(pickLocale(undefined, 'es-CO,es;q=0.9,en;q=0.8')).toBe('es');
    expect(pickLocale(undefined, 'en-US,en;q=0.9,es;q=0.8')).toBe('en');
  });

  it('honours the quality order, not the written order', () => {
    expect(pickLocale(undefined, 'en;q=0.5,es;q=0.9')).toBe('es');
  });

  it('skips languages we do not have', () => {
    expect(pickLocale(undefined, 'fr-FR,de;q=0.9,es;q=0.5')).toBe('es');
  });

  it('falls back to English for an unknown cookie, no header, or nothing we speak', () => {
    expect(pickLocale('klingon', null)).toBe('en');
    expect(pickLocale(undefined, 'fr,de')).toBe('en');
    expect(pickLocale(undefined, '')).toBe('en');
  });
});

describe('the two dictionaries', () => {
  /** Every key path, with "fn" for texts that take values. */
  function shape(value: unknown, path = ''): string[] {
    if (typeof value === 'function') return [`${path}:fn`];
    if (typeof value === 'string') return [`${path}:text`];
    return Object.entries(value as object).flatMap(([key, child]) =>
      shape(child, path ? `${path}.${key}` : key),
    );
  }

  it('have exactly the same texts', () => {
    expect(shape(es)).toEqual(shape(en));
  });

  it('leave nothing empty', () => {
    for (const dictionary of [en, es]) {
      const texts = JSON.stringify(dictionary, (_key, value: unknown) =>
        typeof value === 'function' ? 'fn' : value,
      );
      expect(texts).not.toContain('""');
    }
  });
});
