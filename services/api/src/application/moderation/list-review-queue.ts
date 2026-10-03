import type { Viewer } from '../../domain/moderation';
import type { Video } from '../../domain/video';
import { ForbiddenError } from '../errors';
import type { VideoRepository } from '../ports';
import { MAX_LISTED_VIDEOS } from '../video/list-my-videos';

export class ListReviewQueue {
  constructor(private readonly videos: VideoRepository) {}

  /** Admins only. Oldest first, so nobody's upload waits behind newer ones. */
  async execute(input: { viewer: Viewer }): Promise<Video[]> {
    if (!input.viewer.isAdmin) throw new ForbiddenError();
    return this.videos.listAwaitingReview(MAX_LISTED_VIDEOS);
  }
}
