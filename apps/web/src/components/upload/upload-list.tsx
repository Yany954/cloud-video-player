'use client';

import { CircleAlert, CircleCheck, Pause, Play, X } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format';
import type { UploadItem } from '@/lib/upload/use-uploads';
import { cn } from '@/lib/utils';

interface UploadListProps {
  items: UploadItem[];
  onPause(id: string): void;
  onResume(id: string): void;
  onCancel(id: string): void;
  onDismiss(id: string): void;
}

export function UploadList({ items, onPause, ...rest }: UploadListProps) {
  // Pausing asks first, because the parts being sent at that moment are not kept.
  const [pauseRequestId, setPauseRequestId] = useState<string | null>(null);
  const pausing = items.find((item) => item.id === pauseRequestId && item.status === 'uploading');
  const actions = { ...rest, onPause: setPauseRequestId };

  if (items.length === 0) return null;

  const finished = items.filter((item) => item.status === 'done').map((item) => item.fileName);
  const failed = items.filter((item) => item.status === 'error').map((item) => item.fileName);

  return (
    <section aria-labelledby="uploads-title" className="grid gap-3">
      <h2 id="uploads-title" className="text-base font-semibold tracking-tight">
        Uploads
      </h2>
      <ul className="grid gap-3">
        {items.map((item) => (
          <UploadRow key={item.id} item={item} {...actions} />
        ))}
      </ul>
      <AlertDialog
        open={pausing !== undefined}
        onOpenChange={(open) => {
          if (!open) setPauseRequestId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              {pausing && <PauseWarning item={pausing} />}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep uploading</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pausing) onPause(pausing.id);
              }}
            >
              Pause
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Screen readers hear outcomes without a stream of percentage updates. */}
      <p aria-live="polite" className="sr-only">
        {finished.length > 0 && `Uploaded: ${finished.join(', ')}. `}
        {failed.length > 0 && `Failed: ${failed.join(', ')}.`}
      </p>
    </section>
  );
}

function PauseWarning({ item }: { item: UploadItem }) {
  const unsaved = Math.max(item.uploadedBytes - item.savedBytes, 0);
  if (unsaved === 0) return <>Everything sent so far is saved. You can resume at any time.</>;
  return (
    <>
      A video is sent in parts, and a part is only saved once it has arrived completely. The parts
      being sent right now ({formatBytes(unsaved)}) will be sent again when you resume. The{' '}
      {formatBytes(item.savedBytes)} already saved are kept.
    </>
  );
}

function UploadRow({
  item,
  onPause,
  onResume,
  onCancel,
  onDismiss,
}: { item: UploadItem } & Omit<UploadListProps, 'items'>) {
  const fraction = item.sizeBytes > 0 ? item.uploadedBytes / item.sizeBytes : 0;
  const percent = Math.floor(fraction * 100);
  const active = item.status === 'uploading' || item.status === 'paused';

  return (
    <li className="bg-card grid gap-3 rounded-3xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="truncate font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          <p className="text-muted-foreground text-sm tabular-nums">
            {active
              ? `${formatBytes(item.uploadedBytes)} of ${formatBytes(item.sizeBytes)}`
              : formatBytes(item.sizeBytes)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {item.status === 'uploading' && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPause(item.id)}
              aria-label={`Pause ${item.fileName}`}
            >
              <Pause aria-hidden />
            </Button>
          )}
          {(item.status === 'paused' || (item.status === 'error' && item.canResume)) && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onResume(item.id)}
              aria-label={`Resume ${item.fileName}`}
            >
              <Play aria-hidden />
            </Button>
          )}
          {item.status === 'done' || !item.canResume ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDismiss(item.id)}
              aria-label={`Dismiss ${item.fileName}`}
            >
              <X aria-hidden />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCancel(item.id)}
              aria-label={`Cancel ${item.fileName}`}
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {active && (
        <div
          role="progressbar"
          aria-label={`Upload progress of ${item.fileName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="bg-primary/15 h-2 overflow-hidden rounded-full"
        >
          <div
            className={cn(
              'h-full origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none',
              item.status === 'paused' ? 'bg-muted-foreground' : 'bg-primary',
            )}
            style={{ transform: `scaleX(${fraction})` }}
          />
        </div>
      )}

      <p className="flex items-center gap-1.5 text-sm">
        {item.status === 'uploading' && (
          <span className="text-muted-foreground tabular-nums">Uploading, {percent}%</span>
        )}
        {item.status === 'paused' && (
          <span className="text-muted-foreground tabular-nums">Paused at {percent}%</span>
        )}
        {item.status === 'done' && (
          <>
            <CircleCheck aria-hidden className="text-primary size-4 shrink-0" />
            <span>Uploaded. It will appear for others once it has been reviewed.</span>
          </>
        )}
        {item.status === 'error' && (
          <>
            <CircleAlert aria-hidden className="text-destructive size-4 shrink-0" />
            <span className="text-destructive">{item.error}</span>
          </>
        )}
      </p>
    </li>
  );
}
