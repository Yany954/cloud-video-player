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
import { useI18n } from '@/lib/i18n/i18n-context';

interface ReviewActionsProps {
  video: { id: string; title: string };
  status: ModerationStatus;
  onReviewed(video: VideoResponse): void;
  onError(message: string): void;
}

/** Approve and reject, for admins. Offers only the decisions that would change something. */
export function ReviewActions({ video, status, onReviewed, onError }: ReviewActionsProps) {
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const { t } = useI18n();
  const r = t.review;

  async function review(decision: ReviewDecision) {
    setBusy(decision);
    try {
      onReviewed(await uploadApi.reviewVideo(video.id, decision));
    } catch {
      onError(decision === 'approve' ? r.approveFailed(video.title) : r.rejectFailed(video.title));
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
          aria-label={r.approveLabel(video.title)}
        >
          <Check aria-hidden />
          {busy === 'approve' ? r.approving : r.approve}
        </Button>
      )}
      {status !== 'rejected' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={busy !== null}
              aria-label={live ? r.takeDownLabel(video.title) : r.rejectLabel(video.title)}
            >
              <X aria-hidden />
              {busy === 'reject' ? r.rejecting : live ? r.takeDown : r.reject}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{live ? r.takeDownTitle : r.rejectTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {live ? r.takeDownText(video.title) : r.rejectText(video.title)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.keepAsItIs}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void review('reject')}>
                {live ? r.takeDown : r.rejectVideo}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
