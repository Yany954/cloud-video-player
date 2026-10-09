import { isOwnedBy, renameVideo, type Video } from '../../domain/video';
import { NotFoundError } from '../errors';
import type { VideoRepository } from '../ports';

export class RenameVideo {
  constructor(private readonly videos: VideoRepository) {}

  /** Only the owner renames. Anyone else gets "not found", as if the video did not exist. */
  async execute(input: { userId: string; videoId: string; title: string }): Promise<Video> {
    const video = await this.videos.findById(input.videoId);
    if (!video || !isOwnedBy(video, input.userId)) throw new NotFoundError();

    const renamed = renameVideo(video, input.title);
    await this.videos.saveTitle(renamed);
    return renamed;
  }
}
