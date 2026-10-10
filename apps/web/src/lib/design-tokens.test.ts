import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DARK_COLORS, EVENT_THEME_COLORS as SHARED_THEMES, LIGHT_COLORS } from '@cvp/shared';
import { describe, expect, it } from 'vitest';
import { EVENT_THEME_COLORS } from './event/themes';

// The website's colours live in globals.css (OKLCH, for Tailwind); the mobile app uses the
// same colours from packages/shared (sRGB). This keeps the two from drifting apart.

/** OKLCH to `#RRGGBB`, the standard conversion through OKLab and linear sRGB. */
function oklchToHex(l: number, c: number, h: number): string {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const [L, M, S] = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as [number, number, number];
  const linear = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  return (
    '#' +
    linear
      .map((value) => {
        const clamped = Math.min(1, Math.max(0, value));
        const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
      .toUpperCase()
  );
}

const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8');

/** The custom properties of one rule, e.g. `:root {` or `:root[data-theme='dark'] {`. */
function tokensOf(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  const found: Record<string, string> = {};
  for (const [, name, l, c, h] of block.matchAll(
    /--([\w-]+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g,
  )) {
    found[name!] = oklchToHex(Number(l), Number(c), Number(h));
  }
  return found;
}

const SAME: [keyof typeof LIGHT_COLORS, string][] = [
  ['background', 'background'],
  ['surface', 'card'],
  ['surfaceElevated', 'muted'],
  ['textPrimary', 'foreground'],
  ['textSecondary', 'muted-foreground'],
  ['accent', 'primary'],
  ['accentForeground', 'primary-foreground'],
  ['border', 'border'],
  ['inputBorder', 'input'],
  ['danger', 'destructive'],
];

describe('shared design tokens', () => {
  it.each(SAME)('light "%s" is the website’s --%s', (token, property) => {
    expect(LIGHT_COLORS[token]).toBe(tokensOf(':root')[property]);
  });

  it.each(SAME)('dark "%s" is the website’s --%s', (token, property) => {
    expect(DARK_COLORS[token]).toBe(tokensOf(":root[data-theme='dark']")[property]);
  });

  it('has the same event themes as the website', () => {
    expect(SHARED_THEMES).toEqual(EVENT_THEME_COLORS);
  });
});
