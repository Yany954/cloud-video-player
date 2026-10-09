import { z } from 'zod';

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
  /** The event the video was put in, if any. */
  eventId: string | null;
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
  /** True for the video's owner and for admins. */
  canDelete: boolean;
  /** The caller uploaded it: reporting and blocking are for other people's videos. */
  isMine: boolean;
}

export const VIDEO_TITLE_MAX_LENGTH = 200;

export const renameVideoRequestSchema = z.object({
  title: z.string().trim().min(1).max(VIDEO_TITLE_MAX_LENGTH),
});
export type RenameVideoRequest = z.infer<typeof renameVideoRequestSchema>;

export interface ListVideosResponse {
  videos: VideoResponse[];
}
