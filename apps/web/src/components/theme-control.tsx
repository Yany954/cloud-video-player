'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  isThemeChoice,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeChoice,
} from '@/lib/theme';

const CHANGED = 'cvp-theme-changed';

function readChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice) {
  const deviceIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = resolveTheme(choice, deviceIsDark);
}

function subscribe(notify: () => void) {
  const device = window.matchMedia('(prefers-color-scheme: dark)');
  // "Match my device" keeps following the device while the page is open.
  const deviceChanged = () => {
    apply(readChoice());
    notify();
  };
  device.addEventListener('change', deviceChanged);
  window.addEventListener(CHANGED, notify);
  // Another tab changed the choice.
  window.addEventListener('storage', deviceChanged);
  return () => {
    device.removeEventListener('change', deviceChanged);
    window.removeEventListener(CHANGED, notify);
    window.removeEventListener('storage', deviceChanged);
  };
}

/** The stored choice and the theme now applied. On the server: "system" and "light". */
export function useTheme() {
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, readChoice, () => 'system');
  const applied = useSyncExternalStore<ResolvedTheme>(
    subscribe,
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
    () => 'light',
  );
  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode): the choice then lasts for this page only.
    }
    apply(next);
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return { choice, applied, setChoice };
}

/** One button for the header: switches between light and dark. */
export function ThemeToggle() {
  const { applied, setChoice } = useTheme();
  const next = applied === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setChoice(next)}
      aria-label={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      // The server cannot know the theme; the label settles when the page starts.
      suppressHydrationWarning
    >
      {applied === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Match my device', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

/** The full choice, for the profile page. */
export function ThemeChoiceGroup() {
  const { choice, setChoice } = useTheme();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Colours</legend>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className="has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-ring/50 flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-focus-visible:ring-3"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={choice === value}
              onChange={() => setChoice(value)}
              className="sr-only"
            />
            <Icon aria-hidden className="size-4" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
