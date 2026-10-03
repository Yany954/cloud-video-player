import { activeUploadSession } from '../../domain/video';
import type { ObjectStorage, VideoRepository } from '../ports';
import { findOwnedVideo } from './owned-video';

export class AbortUpload {
  constructor(
    private readonly videos: VideoRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(input: { userId: string; videoId: string }): Promise<void> {
    const video = await findOwnedVideo(this.videos, input.videoId, input.userId);
    await this.storage.abortMultipartUpload(video, activeUploadSession(video));
    await this.videos.delete(video.id);
  }
}
