import { EVENT_THEMES } from '@cvp/shared';
import { describe, expect, it } from 'vitest';
import { EVENT_THEME_COLORS, knownTheme, themeBackground } from './themes';

function luminance(hex: string): number {
  const channel = (index: number) => {
    const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG contrast of white text over `hex` seen through a black scrim of the given opacity. */
function whiteContrastThroughScrim(hex: string, scrim: number): number {
  const dimmed = `#${[0, 1, 2]
    .map((index) =>
      Math.round(parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) * (1 - scrim))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
  return 1.05 / (luminance(dimmed) + 0.05);
}

describe('event themes', () => {
  it('has colours for every theme the API knows', () => {
    expect(Object.keys(EVENT_THEME_COLORS).sort()).toEqual([...EVENT_THEMES].sort());
  });

  it('keeps the event title readable on every colour of every theme (AA for text: 4.5)', () => {
    // The header puts a 60% black scrim behind the title.
    for (const colors of Object.values(EVENT_THEME_COLORS)) {
      for (const color of colors) {
        expect(whiteContrastThroughScrim(color, 0.6)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('builds a CSS background from the three colours', () => {
    expect(themeBackground('stage')).toContain('#0b1230');
    expect(themeBackground('stage')).toContain('#2447d6cc');
  });

  it('falls back to the default for a theme it does not know, or none at all', () => {
    expect(knownTheme('gold')).toBe('gold');
    expect(knownTheme('neon')).toBe('stage');
    expect(knownTheme(undefined)).toBe('stage');
    expect(themeBackground(undefined as never)).toContain('#0b1230');
  });
});
