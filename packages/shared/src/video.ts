// Contracts shared by api, web and mobile. Types only — business rules live in services/api/src/domain.

export const MODERATION_STATUSES = ['pending', 'approved', 'flagged', 'rejected'] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export function isModerationStatus(value: unknown): value is ModerationStatus {
  return typeof value === 'string' && (MODERATION_STATUSES as readonly string[]).includes(value);
}

export type UploadStatus = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';

export interface VideoResponse {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number | null;
  uploadStatus: UploadStatus;
  moderationStatus: ModerationStatus;
  createdAt: string;
}

export interface ListVideosResponse {
  videos: VideoResponse[];
}
