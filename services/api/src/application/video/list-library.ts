import { isHiddenByBlock } from '../../domain/safety';
import type { Video } from '../../domain/video';
import type { BlockRepository, VideoRepository } from '../ports';
import { blockedIdsOf, NO_BLOCKS } from '../safety/defaults';
import { MAX_LISTED_VIDEOS } from './list-my-videos';

export class ListLibrary {
  constructor(
    private readonly videos: VideoRepository,
    private readonly blocks: BlockRepository = NO_BLOCKS,
  ) {}

  /**
   * What every signed-in user can watch: approved videos from all owners, newest first, minus
   * those of people the caller blocked.
   */
  async execute(input: { userId?: string } = {}): Promise<Video[]> {
    const videos = await this.videos.listLibrary(MAX_LISTED_VIDEOS);
    if (input.userId === undefined) return videos;
    const blocked = await blockedIdsOf(this.blocks, input.userId);
    return videos.filter((video) => !isHiddenByBlock(video, blocked));
  }
}
