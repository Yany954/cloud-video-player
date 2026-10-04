import { z } from 'zod';
import type { VideoResponse } from './video';

// Contracts for reporting a video and blocking a person, shared by api, web and mobile.

export const REPORT_REASONS = ['violence', 'sexual', 'harassment', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const MAX_REPORT_NOTE_LENGTH = 500;

export const reportVideoRequestSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().max(MAX_REPORT_NOTE_LENGTH).optional(),
});
export type ReportVideoRequest = z.infer<typeof reportVideoRequestSchema>;

export const blockUploaderRequestSchema = z.object({
  /** A video uploaded by the person to block. The app never exposes other users' ids. */
  videoId: z.string().min(1),
});
export type BlockUploaderRequest = z.infer<typeof blockUploaderRequestSchema>;

/** What an admin sees of one report. */
export interface ReportResponse {
  reason: ReportReason;
  note: string | null;
  createdAt: string;
  /** Null if the reporter's account no longer exists. */
  reporterEmail: string | null;
}

export interface ReviewItemResponse extends VideoResponse {
  /** Empty for a video that is simply waiting for its first review. */
  reports: ReportResponse[];
}

export interface ReviewQueueResponse {
  videos: ReviewItemResponse[];
}

export interface BlockResponse {
  /** Pass it to "unblock". */
  id: string;
  /** The video the block started from: the app shows no names of other users. */
  videoTitle: string;
  createdAt: string;
}

export interface ListBlocksResponse {
  blocks: BlockResponse[];
}
