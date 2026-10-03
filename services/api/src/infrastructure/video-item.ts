import type { Video } from '../domain/video';

// Single-table key patterns. See infra/lib/data-stack.ts for the full table.
export const videoKey = (videoId: string) => ({ PK: `VIDEO#${videoId}`, SK: 'META' });
export const userKey = (userId: string) => ({ PK: `USER#${userId}`, SK: 'PROFILE' });

// An upload nobody finishes is deleted by DynamoDB one day after S3 aborts its parts (7 days).
const ABANDONED_UPLOAD_TTL_SECONDS = 8 * 24 * 60 * 60;

export const ownerIndex = {
  name: 'GSI1',
  partitionKey: (ownerId: string) => `OWNER#${ownerId}`,
};

export type VideoItem = Video &
  ReturnType<typeof videoKey> & {
    type: 'Video';
    /** GSI1: "my videos", newest first. */
    GSI1PK: string;
    GSI1SK: string;
    /** TTL attribute, epoch seconds. Only present while uploading. */
    expiresAt?: number;
  };

export function toVideoItem(video: Video): VideoItem {
  return {
    ...videoKey(video.id),
    type: 'Video',
    GSI1PK: ownerIndex.partitionKey(video.ownerId),
    GSI1SK: video.createdAt,
    ...(video.uploadStatus === 'uploading' && {
      expiresAt: Math.floor(Date.parse(video.createdAt) / 1000) + ABANDONED_UPLOAD_TTL_SECONDS,
    }),
    ...video,
  };
}

/** `item` is whatever DynamoDB returned for a key built with `videoKey`. */
export function fromVideoItem(item: object): Video {
  const video = item as VideoItem;
  return {
    id: video.id,
    ownerId: video.ownerId,
    title: video.title,
    fileName: video.fileName,
    format: video.format,
    categoryId: video.categoryId,
    declaredSizeBytes: video.declaredSizeBytes,
    sizeBytes: video.sizeBytes,
    uploadStatus: video.uploadStatus,
    moderationStatus: video.moderationStatus,
    uploadSessionId: video.uploadSessionId,
    // Items written before processing existed don't have these attributes.
    media: video.media ?? null,
    failureReason: video.failureReason ?? null,
    createdAt: video.createdAt,
  };
}
