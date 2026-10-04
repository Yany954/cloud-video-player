import { describe, expect, it } from 'vitest';
import { isThemeChoice, resolveTheme, THEME_BOOT_SCRIPT, THEME_STORAGE_KEY } from './theme';

describe('resolveTheme', () => {
  it('follows the device when the choice is "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('keeps an explicit choice whatever the device says', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('isThemeChoice', () => {
  it.each(['system', 'light', 'dark'])('accepts %s', (value) => {
    expect(isThemeChoice(value)).toBe(true);
  });

  it.each([null, '', 'blue', 1])('rejects %j', (value) => {
    expect(isThemeChoice(value)).toBe(false);
  });
});

describe('the boot script', () => {
  /** Runs the script against a fake page and returns the theme it applied. */
  function boot(stored: string | null, deviceIsDark: boolean, storageThrows = false) {
    const dataset: Record<string, string> = {};
    const run = new Function('localStorage', 'window', 'document', THEME_BOOT_SCRIPT);
    run(
      {
        getItem: (key: string) => {
          if (storageThrows) throw new Error('blocked');
          return key === THEME_STORAGE_KEY ? stored : null;
        },
      },
      { matchMedia: () => ({ matches: deviceIsDark }) },
      { documentElement: { dataset } },
    );
    return dataset.theme;
  }

  it('applies the same theme `resolveTheme` would', () => {
    for (const choice of ['system', 'light', 'dark'] as const) {
      for (const deviceIsDark of [true, false]) {
        expect(boot(choice, deviceIsDark)).toBe(resolveTheme(choice, deviceIsDark));
      }
    }
  });

  it('follows the device when nothing, or nonsense, is stored', () => {
    expect(boot(null, true)).toBe('dark');
    expect(boot('blue', false)).toBe('light');
  });

  it('falls back to light when storage is blocked', () => {
    expect(boot('dark', true, true)).toBe('light');
  });
});
