import { DomainError } from './errors';
import { isMember, type Category } from './category';
import { isOwnedBy, type Video } from './video';

export type ReviewDecision = 'approve' | 'reject';

/** The signed-in person asking to see a video. */
export interface Viewer {
  userId: string;
  isAdmin: boolean;
}

/**
 * Records an admin's decision. Only a playable video can be reviewed (the admin has to watch
 * it first), and a decision can be changed later, e.g. to take down an approved video.
 */
export function reviewVideo(
  video: Video,
  decision: ReviewDecision,
  reviewerId: string,
  now: Date,
): Video {
  if (video.uploadStatus !== 'ready') {
    throw new DomainError('INVALID_STATE', `Video is ${video.uploadStatus}, cannot be reviewed`);
  }
  return {
    ...video,
    moderationStatus: decision === 'approve' ? 'approved' : 'rejected',
    review: { reviewedBy: reviewerId, reviewedAt: now.toISOString() },
  };
}

/** Waiting for an admin: playable, and not decided yet (or reported after a decision). */
export function awaitsReview(video: Video): boolean {
  return (
    video.uploadStatus === 'ready' &&
    (video.moderationStatus === 'pending' || video.moderationStatus === 'flagged')
  );
}

/** Visible to every signed-in user: approved, and not kept inside a private category. */
export function isInLibrary(video: Video): boolean {
  return isApproved(video) && !video.private;
}

function isApproved(video: Video): boolean {
  return video.uploadStatus === 'ready' && video.moderationStatus === 'approved';
}

/**
 * The owner always sees their own video. An admin sees any playable video, to review it.
 * Everyone else sees only approved videos: those in the library, plus those of a private
 * category they are a member of. `category` is the video's category, when the caller has it.
 */
export function canView(video: Video, viewer: Viewer, category: Category | null = null): boolean {
  if (isOwnedBy(video, viewer.userId)) return true;
  if (viewer.isAdmin) return video.uploadStatus === 'ready';
  if (!video.private) return isInLibrary(video);
  return (
    isApproved(video) &&
    category !== null &&
    category.id === video.categoryId &&
    isMember(category, viewer.userId)
  );
}

/** Owners delete their own videos; an admin can delete anyone's. */
export function canDelete(video: Video, viewer: Viewer): boolean {
  return isOwnedBy(video, viewer.userId) || viewer.isAdmin;
}

/** Processing has to finish first, or the job would write files for a video that is gone. */
export function assertDeletable(video: Video): void {
  if (video.uploadStatus === 'processing') {
    throw new DomainError('INVALID_STATE', 'Video is being processed, try again in a moment');
  }
}
