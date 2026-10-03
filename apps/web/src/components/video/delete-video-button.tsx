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
          ? `“${video.title}” is still being prepared. Try again in a moment.`
          : `“${video.title}” could not be deleted. Check your connection and try again.`,
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
          aria-label={`Delete ${video.title}`}
          className={iconOnly ? 'text-muted-foreground hover:text-destructive' : undefined}
        >
          <Trash2 aria-hidden />
          {!iconOnly && (busy ? 'Deleting…' : 'Delete video')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this video?</AlertDialogTitle>
          <AlertDialogDescription>
            “{video.title}” and its original file will be deleted for everyone. You cannot undo
            this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep video</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void remove()}>
            Delete video
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
