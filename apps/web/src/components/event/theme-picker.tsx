'use client';

import { EVENT_THEMES, type EventTheme } from '@cvp/shared';
import { useI18n } from '@/lib/i18n/i18n-context';
import { knownTheme, themeBackground } from '@/lib/event/themes';

/** The owner's choice of header colours: one swatch per theme, as a radio group. */
export function ThemePicker({
  value,
  disabled,
  onChange,
}: {
  value: EventTheme;
  disabled: boolean;
  onChange(theme: EventTheme): void;
}) {
  const { t } = useI18n();
  return (
    <fieldset disabled={disabled} className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{t.event.themeLegend}</legend>
      <div className="flex flex-wrap gap-2">
        {EVENT_THEMES.map((theme) => (
          <label
            key={theme}
            className="has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-ring/50 flex h-9 cursor-pointer items-center gap-2 rounded-lg border pr-3 pl-1.5 text-sm has-focus-visible:ring-3 has-disabled:cursor-default has-disabled:opacity-60"
          >
            <input
              type="radio"
              name="event-theme"
              value={theme}
              checked={knownTheme(value) === theme}
              onChange={() => onChange(theme)}
              className="sr-only"
            />
            <span
              aria-hidden
              className="size-6 rounded-md border"
              style={{ background: themeBackground(theme) }}
            />
            {t.event.themes[theme]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
