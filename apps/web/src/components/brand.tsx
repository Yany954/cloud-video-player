import { Play } from 'lucide-react';

/** `compact` keeps only the mark on narrow screens; the name stays for screen readers. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
        <Play aria-hidden className="size-3.5 fill-current" strokeWidth={2} />
      </span>
      <span
        className={`text-base font-semibold tracking-tight ${compact ? 'sr-only sm:not-sr-only' : ''}`}
        translate="no"
      >
        Cloud Video Player
      </span>
    </span>
  );
}
