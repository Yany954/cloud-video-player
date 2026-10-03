'use client';

import type { ModerationStatus, ReviewDecision, VideoResponse } from '@cvp/shared';
import { Check, X } from 'lucide-react';
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

interface ReviewActionsProps {
  video: { id: string; title: string };
  status: ModerationStatus;
  onReviewed(video: VideoResponse): void;
  onError(message: string): void;
}

/** Approve and reject, for admins. Offers only the decisions that would change something. */
export function ReviewActions({ video, status, onReviewed, onError }: ReviewActionsProps) {
  const [busy, setBusy] = useState<ReviewDecision | null>(null);

  async function review(decision: ReviewDecision) {
    setBusy(decision);
    try {
      onReviewed(await uploadApi.reviewVideo(video.id, decision));
    } catch {
      onError(
        `“${video.title}” could not be ${decision === 'approve' ? 'approved' : 'rejected'}. Check your connection and try again.`,
      );
    } finally {
      setBusy(null);
    }
  }

  const live = status === 'approved';

  return (
    <>
      {status !== 'approved' && (
        <Button
          disabled={busy !== null}
          onClick={() => void review('approve')}
          aria-label={`Approve ${video.title}`}
        >
          <Check aria-hidden />
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </Button>
      )}
      {status !== 'rejected' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={busy !== null}
              aria-label={`${live ? 'Take down' : 'Reject'} ${video.title}`}
            >
              <X aria-hidden />
              {busy === 'reject' ? 'Rejecting…' : live ? 'Take down' : 'Reject'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {live ? 'Take this video down?' : 'Reject this video?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {live
                  ? `“${video.title}” will leave the library. Only the person who uploaded it will still be able to watch it.`
                  : `“${video.title}” will not appear in the library. Only the person who uploaded it will be able to watch it.`}{' '}
                You can approve it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep as it is</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void review('reject')}>
                {live ? 'Take down' : 'Reject video'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
