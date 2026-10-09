import { DomainError } from '../../domain/errors';
import { canView, type Viewer } from '../../domain/moderation';
import { isHiddenByBlock } from '../../domain/safety';
import type { MediaInfo, Video } from '../../domain/video';
import { NotFoundError } from '../errors';
import type { BlockRepository, CategoryRepository, VideoRepository } from '../ports';
import { blockedIdsOf } from '../safety/defaults';

export type WatchableVideo = Video & { media: MediaInfo };

/**
 * The one rule for "may this person watch this video now", shared by playing and downloading.
 * A video the viewer may not see answers "not found", so its existence stays private.
 */
export async function findWatchable(
  deps: { videos: VideoRepository; categories: CategoryRepository; blocks: BlockRepository },
  input: { viewer: Viewer; videoId: string },
): Promise<WatchableVideo> {
  const video = await deps.videos.findById(input.videoId);
  if (!video) throw new NotFoundError();
  // Other people reach a video only through its event, so that is what gets checked.
  const category = video.categoryId ? await deps.categories.findById(video.categoryId) : null;
  if (!canView(video, input.viewer, category)) throw new NotFoundError();
  // Admins still open a blocked person's video, to review it.
  if (
    !input.viewer.isAdmin &&
    isHiddenByBlock(video, await blockedIdsOf(deps.blocks, input.viewer.userId))
  ) {
    throw new NotFoundError();
  }
  if (video.uploadStatus !== 'ready' || video.media === null) {
    throw new DomainError('INVALID_STATE', `Video is ${video.uploadStatus}, not ready to play`);
  }
  return video as WatchableVideo;
}
