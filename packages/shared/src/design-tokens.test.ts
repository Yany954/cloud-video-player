import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  DARK_COLORS,
  EVENT_THEME_COLORS,
  LIGHT_COLORS,
  type ColorTokens,
} from './design-tokens';

describe('contrastRatio', () => {
  it('matches the known extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe.each([
  ['light', LIGHT_COLORS],
  ['dark', DARK_COLORS],
] as [string, ColorTokens][])('%s colours meet WCAG AA', (_, c) => {
  it.each([
    ['text on the background', c.textPrimary, c.background],
    ['text on a surface', c.textPrimary, c.surface],
    ['text on an elevated surface', c.textPrimary, c.surfaceElevated],
    ['secondary text on the background', c.textSecondary, c.background],
    ['secondary text on a surface', c.textSecondary, c.surface],
    ['secondary text on an elevated surface', c.textSecondary, c.surfaceElevated],
    ['a button label on the accent', c.accentForeground, c.accent],
    ['accent text on the background', c.accent, c.background],
    ['an error on the background', c.danger, c.background],
    ['a success message on the background', c.success, c.background],
  ])('%s is at least 4.5:1', (_what, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('a text box outline is at least 3:1 against what is around it', () => {
    expect(contrastRatio(c.inputBorder, c.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c.inputBorder, c.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('event themes', () => {
  it.each(Object.entries(EVENT_THEME_COLORS))(
    '%s keeps white text readable on its base',
    (_, [base]) => {
      expect(contrastRatio('#FFFFFF', base)).toBeGreaterThanOrEqual(7);
    },
  );
});
