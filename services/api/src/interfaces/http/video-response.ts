import type { VideoResponse } from '@cvp/shared';
import type { Video } from '../../domain/video';

/** What clients see: no owner id, storage keys or upload session. */
export function toVideoResponse(video: Video): VideoResponse {
  return {
    id: video.id,
    title: video.title,
    fileName: video.fileName,
    sizeBytes: video.sizeBytes,
    uploadStatus: video.uploadStatus,
    moderationStatus: video.moderationStatus,
    createdAt: video.createdAt,
  };
}
