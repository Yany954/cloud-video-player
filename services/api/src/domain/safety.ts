import { DomainError } from './errors';
import { isOwnedBy, type Video } from './video';

// Reporting a video and blocking a person: what app stores require of apps with
// user-generated content.

export const REPORT_REASONS = ['violence', 'sexual', 'harassment', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const MAX_NOTE_LENGTH = 500;

export interface Report {
  readonly videoId: string;
  readonly reporterId: string;
  readonly reason: ReportReason;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface CreateReportInput {
  video: Video;
  reporterId: string;
  reason: ReportReason;
  note?: string;
  now: Date;
}

/** Anyone but the uploader can report a video, once. */
export function createReport(input: CreateReportInput): Report {
  if (isOwnedBy(input.video, input.reporterId)) {
    throw new DomainError('INVALID_STATE', 'You cannot report your own video');
  }
  const note = input.note?.trim() ?? '';
  if (note.length > MAX_NOTE_LENGTH) {
    throw new DomainError('INVALID_NOTE', `A note has at most ${MAX_NOTE_LENGTH} characters`);
  }
  return {
    videoId: input.video.id,
    reporterId: input.reporterId,
    reason: input.reason,
    note: note.length > 0 ? note : null,
    createdAt: input.now.toISOString(),
  };
}

/**
 * A reported video is hidden at once and goes back to the review queue. One an admin already
 * rejected stays rejected, and one not reviewed yet simply stays in the queue.
 */
export function flagVideo(video: Video): Video {
  return video.moderationStatus === 'approved' ? { ...video, moderationStatus: 'flagged' } : video;
}

/** One person hiding another's videos from themselves. The blocked person is not told. */
export interface Block {
  readonly blockerId: string;
  readonly blockedId: string;
  /** How the blocker recognises the entry later: the app shows no names of other users. */
  readonly videoTitle: string;
  readonly createdAt: string;
}

export function createBlock(input: { video: Video; blockerId: string; now: Date }): Block {
  if (isOwnedBy(input.video, input.blockerId)) {
    throw new DomainError('INVALID_STATE', 'You cannot block yourself');
  }
  return {
    blockerId: input.blockerId,
    blockedId: input.video.ownerId,
    videoTitle: input.video.title,
    createdAt: input.now.toISOString(),
  };
}

/** True when the viewer blocked the video's uploader. A person's own videos are never hidden. */
export function isHiddenByBlock(video: Video, blockedIds: ReadonlySet<string>): boolean {
  return blockedIds.has(video.ownerId);
}
