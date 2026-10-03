import { assertDeletable, canDelete, type Viewer } from '../../domain/moderation';
import { NotFoundError } from '../errors';
import type { ObjectStorage, VideoRepository } from '../ports';

export class DeleteVideo {
  constructor(
    private readonly videos: VideoRepository,
    private readonly storage: ObjectStorage,
  ) {}

  /**
   * Permanent. The record goes first, so the video is gone for everyone even if removing a
   * file then fails: that leaves an orphan file, never a listed video with no file.
   */
  async execute(input: { viewer: Viewer; videoId: string }): Promise<void> {
    const video = await this.videos.findById(input.videoId);
    if (!video || !canDelete(video, input.viewer)) throw new NotFoundError();
    assertDeletable(video);

    if (video.uploadStatus === 'uploading') {
      // Nothing was counted yet: only the unfinished upload to discard.
      if (video.uploadSessionId) {
        await this.storage.abortMultipartUpload(video, video.uploadSessionId);
      }
      await this.videos.delete(video.id);
      return;
    }

    await this.videos.deleteCounted(video);
    await Promise.all([this.storage.deleteOriginal(video), this.storage.deletePlayable(video)]);
  }
}
