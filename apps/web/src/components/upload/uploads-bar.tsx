'use client';

import { CircleAlert, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HOME } from '@/lib/auth/return-to';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useSharedUploads } from '@/lib/upload/uploads-context';

/**
 * A thin strip under the navigation, on every page except the one with the full upload list:
 * it says that uploads are still running (or need attention) and leads back to them.
 */
export function UploadsBar() {
  const { items } = useSharedUploads();
  const pathname = usePathname();
  const { t } = useI18n();
  const b = t.uploadsBar;

  const running = items.filter((item) => item.status === 'uploading');
  const waiting = items.filter((item) => item.status === 'paused' || item.status === 'error');
  if (pathname === HOME || (running.length === 0 && waiting.length === 0)) return null;

  const total = running.reduce((sum, item) => sum + item.sizeBytes, 0);
  const sent = running.reduce((sum, item) => sum + item.uploadedBytes, 0);
  const percent = total > 0 ? Math.floor((sent / total) * 100) : 0;

  return (
    <div className="bg-muted/60 border-b">
      <Link
        href={HOME}
        className="focus-visible:ring-ring/50 mx-auto flex min-h-11 w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-inset sm:px-6"
      >
        {running.length > 0 && (
          <span className="flex items-center gap-1.5 tabular-nums">
            <UploadCloud aria-hidden className="size-4 shrink-0" />
            {b.uploading(running.length, percent)}
          </span>
        )}
        {waiting.length > 0 && (
          <span className="flex items-center gap-1.5">
            <CircleAlert aria-hidden className="text-destructive size-4 shrink-0" />
            {b.waiting(waiting.length)}
          </span>
        )}
        <span className="text-muted-foreground underline underline-offset-4">{b.view}</span>
      </Link>
    </div>
  );
}
