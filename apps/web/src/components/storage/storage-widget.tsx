import type { StorageUsageResponse } from '@cvp/shared';
import { Cloud } from 'lucide-react';
import { useFormat, useI18n } from '@/lib/i18n/i18n-context';

const SEGMENTS = 5;

// Adapted from the watermelon-ui widget-2 block: segmented bar, large "used" figure.
export function StorageWidget({ usage }: { usage: StorageUsageResponse | null }) {
  const { t } = useI18n();
  const fmt = useFormat();
  if (!usage) {
    return (
      <div
        aria-busy="true"
        aria-label={t.storage.loading}
        className="bg-card grid gap-4 rounded-3xl border p-5"
      >
        <div className="bg-muted h-5 w-28 animate-pulse rounded-lg motion-reduce:animate-none" />
        <div className="bg-muted h-9 w-40 animate-pulse rounded-lg motion-reduce:animate-none" />
        <div className="bg-muted h-2 animate-pulse rounded-full motion-reduce:animate-none" />
      </div>
    );
  }

  const fraction = Math.min(Math.max(usage.bytesUsed / usage.quotaBytes, 0), 1);
  const free = Math.max(usage.quotaBytes - usage.bytesUsed, 0);

  return (
    <section aria-labelledby="storage-title" className="bg-card grid gap-4 rounded-3xl border p-5">
      <div className="flex items-center gap-2">
        <Cloud aria-hidden className="text-primary size-4" />
        <h2 id="storage-title" className="text-base font-semibold tracking-tight">
          {t.storage.title}
        </h2>
      </div>
      <div className="grid gap-2">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {fmt.bytes(usage.bytesUsed)}
          </span>
          <span className="text-muted-foreground text-sm tabular-nums">
            {t.storage.ofTotal(fmt.bytes(usage.quotaBytes))}
          </span>
        </p>
        <div
          role="meter"
          aria-labelledby="storage-title"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          aria-valuetext={t.storage.usedOf(fmt.bytes(usage.bytesUsed), fmt.bytes(usage.quotaBytes))}
          className="flex h-2 gap-1.5"
        >
          {Array.from({ length: SEGMENTS }, (_, index) => {
            const filled = Math.min(Math.max(fraction * SEGMENTS - index, 0), 1);
            return (
              <div key={index} className="bg-primary/15 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full origin-left rounded-full transition-transform duration-500 motion-reduce:transition-none"
                  style={{ transform: `scaleX(${filled})` }}
                />
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground text-sm tabular-nums">
          {t.storage.free(fmt.bytes(free))}
        </p>
      </div>
    </section>
  );
}
