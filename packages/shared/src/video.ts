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
  /** Why processing failed; null unless uploadStatus is "failed". */
  failureReason: ProcessingFailureReason | null;
  /** Known once the video is "ready". */
  durationSeconds: number | null;
  /** Time-limited link to the poster image; null until the video is "ready". */
  posterUrl: string | null;
  createdAt: string;
}

export type ProcessingFailureReason =
  'NO_VIDEO_STREAM' | 'UNSUPPORTED_VIDEO_CODEC' | 'TOO_LARGE' | 'PROCESSING_ERROR';

export interface PlaybackResponse {
  title: string;
  /** Time-limited links: ask again after `expiresAt`. */
  videoUrl: string;
  posterUrl: string;
  expiresAt: string;
  durationSeconds: number;
  width: number;
  height: number;
  /** Lets an admin see, and change, the decision while watching. */
  moderationStatus: ModerationStatus;
}

export interface ListVideosResponse {
  videos: VideoResponse[];
}
