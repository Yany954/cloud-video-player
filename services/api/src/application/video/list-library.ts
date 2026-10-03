import type { Video } from '../../domain/video';
import type { VideoRepository } from '../ports';
import { MAX_LISTED_VIDEOS } from './list-my-videos';

export class ListLibrary {
  constructor(private readonly videos: VideoRepository) {}

  /** What every signed-in user can watch: approved videos from all owners, newest first. */
  execute(): Promise<Video[]> {
    return this.videos.listLibrary(MAX_LISTED_VIDEOS);
  }
}
