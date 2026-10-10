import { DARK_COLORS, LIGHT_COLORS, RADIUS, type ColorTokens } from '@cvp/shared';
import { useColorScheme } from 'react-native';

/**
 * The shared colour tokens (packages/shared/src/design-tokens.ts), under the names the
 * screens use. The same palette as the website.
 */
function named(tokens: ColorTokens) {
  return {
    background: tokens.background,
    foreground: tokens.textPrimary,
    card: tokens.surface,
    muted: tokens.surfaceElevated,
    mutedForeground: tokens.textSecondary,
    primary: tokens.accent,
    primaryForeground: tokens.accentForeground,
    border: tokens.border,
    input: tokens.inputBorder,
    destructive: tokens.danger,
    success: tokens.success,
  };
}

const light = named(LIGHT_COLORS);
const dark = named(DARK_COLORS);

export type Colors = typeof light;

/** Follows the phone's light or dark appearance (Settings > Display & Brightness). */
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = RADIUS;
/** Apple and Google both ask for touch targets of at least 44 points. */
export const MIN_TOUCH = 44;
