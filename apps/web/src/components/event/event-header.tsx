'use client';

import type { EventTheme } from '@cvp/shared';
import { StageGradient } from '@/components/effects/stage-gradient';
import { EVENT_THEME_COLORS, knownTheme, themeBackground } from '@/lib/event/themes';

/**
 * The top of an event page: its name over a gradient in the event's colours. The gradient
 * moves where effects are allowed and is a plain CSS background everywhere else.
 */
export function EventHeader({
  name,
  theme,
  children,
}: {
  name: string;
  theme: EventTheme;
  /** Shown next to the name, e.g. the "Private" badge. */
  children?: React.ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl">
      <StageGradient
        subtle
        colors={EVENT_THEME_COLORS[knownTheme(theme)]}
        fallback={themeBackground(theme)}
      />
      {/* 60% black behind the title keeps white text readable on every theme (tested). */}
      <div aria-hidden className="absolute inset-0 bg-black/60" />
      <div className="relative flex min-h-36 flex-wrap items-end gap-3 px-5 pt-16 pb-5 sm:min-h-44 sm:px-7">
        <h1 className="min-w-0 text-3xl font-semibold tracking-tight text-balance break-words text-white sm:text-4xl">
          {name}
        </h1>
        {children}
      </div>
    </div>
  );
}
