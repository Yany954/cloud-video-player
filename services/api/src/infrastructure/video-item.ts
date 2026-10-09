import { awaitsReview } from '../domain/moderation';
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

// Sparse: only playable videos that are waiting for an admin's decision carry these keys.
// (Rows written before 2026-10 may still hold `MODERATION#library`; nothing reads it.)
export const moderationIndex = {
  name: 'GSI3',
  queue: 'MODERATION#queue',
};

function moderationKeys(video: Video) {
  return awaitsReview(video) && { GSI3PK: moderationIndex.queue, GSI3SK: video.createdAt };
}

// Sparse: only videos that were put in a category.
export const categoryIndex = {
  name: 'GSI2',
  partitionKey: (categoryId: string) => `CATEGORY#${categoryId}`,
};

function categoryKeys(video: Video) {
  return (
    video.categoryId !== null && {
      GSI2PK: categoryIndex.partitionKey(video.categoryId),
      GSI2SK: video.createdAt,
    }
  );
}

/** The attributes that change when a video moves between categories. */
export const CATEGORY_ATTRIBUTES = ['categoryId', 'private', 'GSI2PK', 'GSI2SK'] as const;

/** The attributes that change when a video is reviewed or reported. */
export const MODERATION_ATTRIBUTES = ['moderationStatus', 'review', 'GSI3PK', 'GSI3SK'] as const;

export type VideoItem = Video &
  ReturnType<typeof videoKey> & {
    type: 'Video';
    /** GSI1: "my videos", newest first. */
    GSI1PK: string;
    GSI1SK: string;
    /** GSI2: the videos of one category. */
    GSI2PK?: string;
    GSI2SK?: string;
    /** GSI3: the review queue. */
    GSI3PK?: string;
    GSI3SK?: string;
    /** TTL attribute, epoch seconds. Only present while uploading. */
    expiresAt?: number;
  };

export function toVideoItem(video: Video): VideoItem {
  return {
    ...videoKey(video.id),
    type: 'Video',
    GSI1PK: ownerIndex.partitionKey(video.ownerId),
    GSI1SK: video.createdAt,
    ...categoryKeys(video),
    ...moderationKeys(video),
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
    private: video.private ?? false,
    declaredSizeBytes: video.declaredSizeBytes,
    sizeBytes: video.sizeBytes,
    uploadStatus: video.uploadStatus,
    moderationStatus: video.moderationStatus,
    uploadSessionId: video.uploadSessionId,
    // Items written before processing, moderation or categories existed lack some attributes.
    media: video.media ?? null,
    failureReason: video.failureReason ?? null,
    review: video.review ?? null,
    createdAt: video.createdAt,
  };
}
