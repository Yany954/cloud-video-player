import type { Video } from '../../domain/video';
import type { VideoRepository } from '../ports';

// Enough for the MVP library. Add a cursor when someone gets close to this many videos.
export const MAX_LISTED_VIDEOS = 100;

export class ListMyVideos {
  constructor(private readonly videos: VideoRepository) {}

  /** Includes the owner's pending and unfinished uploads: only they can see those. */
  execute(input: { userId: string }): Promise<Video[]> {
    return this.videos.listByOwner(input.userId, MAX_LISTED_VIDEOS);
  }
}
