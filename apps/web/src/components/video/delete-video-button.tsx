'use client';

import { ApiError } from '@cvp/upload-client';
import { Trash2 } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { uploadApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n-context';

interface DeleteVideoButtonProps {
  video: { id: string; title: string };
  /** Just the bin icon, for rows in a list. The accessible name stays the same. */
  iconOnly?: boolean;
  onDeleted(): void;
  onError(message: string): void;
}

/** Deleting is permanent, so it always asks first. */
export function DeleteVideoButton({ video, iconOnly, onDeleted, onError }: DeleteVideoButtonProps) {
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();
  const d = t.deleteVideo;

  async function remove() {
    setBusy(true);
    try {
      await uploadApi.deleteVideo(video.id);
      onDeleted();
    } catch (error) {
      // Someone (or another tab) already deleted it: the outcome the user wanted.
      if (error instanceof ApiError && error.status === 404) return onDeleted();
      onError(
        error instanceof ApiError && error.status === 409
          ? d.stillPreparing(video.title)
          : d.failed(video.title),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={iconOnly ? 'ghost' : 'destructive'}
          size={iconOnly ? 'icon-lg' : 'default'}
          disabled={busy}
          aria-label={d.label(video.title)}
          className={iconOnly ? 'text-muted-foreground hover:text-destructive' : undefined}
        >
          <Trash2 aria-hidden />
          {!iconOnly && (busy ? d.deleting : d.button)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{d.dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{d.dialogText(video.title)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{d.keep}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void remove()}>
            {d.button}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
