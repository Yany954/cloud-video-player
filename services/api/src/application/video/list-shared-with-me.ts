import { canView, type Viewer } from '../../domain/moderation';
import { isHiddenByBlock } from '../../domain/safety';
import { isOwnedBy, type Video } from '../../domain/video';
import { MAX_CATEGORY_VIDEOS, MAX_LISTED_CATEGORIES } from '../category/categories';
import type { BlockRepository, CategoryRepository, VideoRepository } from '../ports';
import { blockedIdsOf, NO_BLOCKS } from '../safety/defaults';
import { MAX_LISTED_VIDEOS } from './list-my-videos';

/**
 * "Shared with me": other people's approved videos in the events the caller owns or was
 * invited to, newest first. There is no library that every account sees: a video outside an
 * event belongs to its owner alone.
 */
export class ListSharedWithMe {
  constructor(
    private readonly videos: VideoRepository,
    private readonly categories: CategoryRepository,
    private readonly blocks: BlockRepository = NO_BLOCKS,
  ) {}

  async execute(input: { viewer: Viewer }): Promise<Video[]> {
    const { viewer } = input;
    const [owned, joined, blocked] = await Promise.all([
      this.categories.listByOwner(viewer.userId, MAX_LISTED_CATEGORIES),
      this.categories.listByMember(viewer.userId, MAX_LISTED_CATEGORIES),
      blockedIdsOf(this.blocks, viewer.userId),
    ]);

    const perEvent = await Promise.all(
      [...owned, ...joined].map(async (category) =>
        (await this.videos.listByCategory(category.id, MAX_CATEGORY_VIDEOS)).filter(
          (video) =>
            !isOwnedBy(video, viewer.userId) &&
            // Decided per video against its own event, so an admin gets no more here than
            // any other member: only what was approved.
            canView(video, { ...viewer, isAdmin: false }, category) &&
            !isHiddenByBlock(video, blocked),
        ),
      ),
    );
    return perEvent
      .flat()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_LISTED_VIDEOS);
  }
}
