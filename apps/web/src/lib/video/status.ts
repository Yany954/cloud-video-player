import type { VideoResponse } from '@cvp/shared';

type StatusFields = Pick<VideoResponse, 'uploadStatus' | 'moderationStatus' | 'failureReason'>;

const FAILURE_LABELS: Record<NonNullable<VideoResponse['failureReason']>, string> = {
  UNSUPPORTED_VIDEO_CODEC: 'Format not supported yet',
  TOO_LARGE: 'Too large to process yet',
  NO_VIDEO_STREAM: 'No video found in the file',
  PROCESSING_ERROR: 'Could not be processed',
};

/** One short, plain label for where a video is in its life. */
export function videoStatusLabel(video: StatusFields): string {
  if (video.uploadStatus === 'uploading') return 'Upload not finished';
  if (video.uploadStatus === 'failed') {
    return FAILURE_LABELS[video.failureReason ?? 'PROCESSING_ERROR'];
  }
  if (video.uploadStatus !== 'ready') return 'Being prepared';
  if (video.moderationStatus === 'rejected') return 'Not approved';
  if (video.moderationStatus === 'flagged') return 'Being reviewed';
  if (video.moderationStatus === 'pending') return 'Waiting for review';
  return 'Ready to watch';
}

/** Still changing on the server, so the list should check again soon. */
export function isBeingPrepared(video: Pick<VideoResponse, 'uploadStatus'>): boolean {
  return video.uploadStatus === 'uploaded' || video.uploadStatus === 'processing';
}
