// Light, dark, or "match my device". The choice lives in this browser's storage; what is
// applied to <html data-theme> is always resolved to "light" or "dark".

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cvp.theme';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveTheme(choice: ThemeChoice, deviceIsDark: boolean): ResolvedTheme {
  return choice === 'system' ? (deviceIsDark ? 'dark' : 'light') : choice;
}

/**
 * Runs in <head> before anything is painted, so the page never flashes in the wrong theme.
 * Kept as a string because it must not wait for React. It mirrors `resolveTheme`.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_STORAGE_KEY}');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=c==='light'||c==='dark'?c:(d?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}})()`;
