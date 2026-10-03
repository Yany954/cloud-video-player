import { DomainError } from '../../domain/errors';
import { assertFits } from '../../domain/quota';
import { planUpload } from '../../domain/upload-plan';
import { activeUploadSession, completeUpload, type Video } from '../../domain/video';
import type { ObjectStorage, StorageAccountRepository, VideoRepository } from '../ports';
import { findOwnedVideo } from './owned-video';

export interface CompleteUploadInput {
  userId: string;
  videoId: string;
}

export class CompleteUpload {
  constructor(
    private readonly videos: VideoRepository,
    private readonly accounts: StorageAccountRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(input: CompleteUploadInput): Promise<Video> {
    const video = await findOwnedVideo(this.videos, input.videoId, input.userId);
    const sessionId = activeUploadSession(video);

    // The store, not the client, says which parts exist and how big they are.
    const parts = await this.storage.listUploadedParts(video, sessionId);
    const { partCount } = planUpload(video.declaredSizeBytes);
    if (parts.length !== partCount) {
      throw new DomainError(
        'UPLOAD_INCOMPLETE',
        `${parts.length} of ${partCount} parts have been uploaded`,
      );
    }

    // Quota on the real bytes, before joining the parts, so an oversized file is never kept.
    const measuredBytes = parts.reduce((total, part) => total + part.sizeBytes, 0);
    try {
      assertFits(await this.accounts.getUsage(input.userId), measuredBytes);
    } catch (error) {
      await this.storage.abortMultipartUpload(video, sessionId);
      await this.videos.delete(video.id);
      throw error;
    }

    const sizeBytes = await this.storage.completeMultipartUpload(video, sessionId, parts);
    const completed = completeUpload(video, sizeBytes);
    try {
      // Atomic guard: two uploads finishing at once can't both slip past the quota.
      await this.videos.saveCompleted(completed);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'QUOTA_EXCEEDED') {
        await this.storage.deleteOriginal(video);
        await this.videos.delete(video.id);
      }
      throw error;
    }
    return completed;
  }
}
