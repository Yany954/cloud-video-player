import type { EventTheme } from '@cvp/shared';

/**
 * What each event theme looks like on the web: a dark base, a main colour and an accent.
 * All bases are dark, so white text over the header's scrim stays readable (WCAG AA).
 */
export const EVENT_THEME_COLORS: Record<EventTheme, readonly [string, string, string]> = {
  stage: ['#0b1230', '#2447d6', '#c2630c'],
  sunset: ['#2a0f2e', '#c2410c', '#f59e0b'],
  forest: ['#06221a', '#15803d', '#a3a316'],
  ocean: ['#041c2c', '#0e7490', '#38bdf8'],
  ember: ['#1f0a0a', '#b91c1c', '#ea580c'],
  violet: ['#170f33', '#6d28d9', '#db2777'],
  gold: ['#1c1503', '#a16207', '#eab308'],
  steel: ['#0f1418', '#475569', '#94a3b8'],
};

/**
 * A theme this app can draw. An API that is older (no theme yet) or newer (a theme this build
 * does not know) must never break the page, so anything unknown becomes the default.
 */
export function knownTheme(theme: unknown): EventTheme {
  return typeof theme === 'string' && theme in EVENT_THEME_COLORS ? (theme as EventTheme) : 'stage';
}

/** The same colours as a plain CSS background: the fallback, and the swatches. */
export function themeBackground(theme: EventTheme): string {
  const [base, main, accent] = EVENT_THEME_COLORS[knownTheme(theme)];
  return [
    `radial-gradient(70% 90% at 15% 0%, ${main}cc, transparent 70%)`,
    `radial-gradient(60% 80% at 95% 100%, ${accent}aa, transparent 70%)`,
    base,
  ].join(', ');
}
