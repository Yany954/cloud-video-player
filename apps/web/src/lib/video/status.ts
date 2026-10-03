import type { VideoResponse } from '@cvp/shared';

/** One short, plain label for where a video is in its life. */
export function videoStatusLabel(
  video: Pick<VideoResponse, 'uploadStatus' | 'moderationStatus'>,
): string {
  if (video.uploadStatus === 'uploading') return 'Upload not finished';
  if (video.uploadStatus === 'failed') return 'Could not be processed';
  if (video.moderationStatus === 'rejected') return 'Not approved';
  if (video.moderationStatus === 'flagged') return 'Being reviewed';
  if (video.moderationStatus === 'pending') return 'Waiting for review';
  return video.uploadStatus === 'ready' ? 'Ready to watch' : 'Being prepared';
}
