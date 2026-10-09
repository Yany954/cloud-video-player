import type { VideoResponse } from '@cvp/shared';
import type { Messages } from '@/i18n/messages/en';

type StatusFields = Pick<VideoResponse, 'uploadStatus' | 'moderationStatus' | 'failureReason'>;

/** One short, plain label for where a video is in its life, in `m`'s language. */
export function videoStatusLabel(video: StatusFields, m: Messages['videoStatus']): string {
  if (video.uploadStatus === 'uploading') return m.uploadNotFinished;
  if (video.uploadStatus === 'failed') return m.failed[video.failureReason ?? 'PROCESSING_ERROR'];
  if (video.uploadStatus !== 'ready') return m.beingPrepared;
  if (video.moderationStatus === 'rejected') return m.notApproved;
  if (video.moderationStatus === 'flagged') return m.beingReviewed;
  if (video.moderationStatus === 'pending') return m.waitingForReview;
  return m.readyToWatch;
}

/** Still changing on the server, so the list should check again soon. */
export function isBeingPrepared(video: Pick<VideoResponse, 'uploadStatus'>): boolean {
  return video.uploadStatus === 'uploaded' || video.uploadStatus === 'processing';
}
