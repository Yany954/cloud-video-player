import { planUpload, type UploadPlan } from '../../domain/upload-plan';
import { activeUploadSession } from '../../domain/video';
import type { ObjectStorage, PartUrl, VideoRepository } from '../ports';
import { findOwnedVideo } from './owned-video';

/** URLs are handed out in batches so they don't expire before the client gets to them. */
export const MAX_URLS_PER_REQUEST = 100;

export interface GetPartUrlsInput {
  userId: string;
  videoId: string;
  limit?: number;
}

export interface GetPartUrlsResult extends UploadPlan {
  uploadedPartNumbers: number[];
  urls: PartUrl[];
}

export class GetPartUrls {
  constructor(
    private readonly videos: VideoRepository,
    private readonly storage: ObjectStorage,
  ) {}

  /** Resuming is just calling this again: it only signs URLs for parts the store doesn't have. */
  async execute(input: GetPartUrlsInput): Promise<GetPartUrlsResult> {
    const video = await findOwnedVideo(this.videos, input.videoId, input.userId);
    const sessionId = activeUploadSession(video);
    const plan = planUpload(video.declaredSizeBytes);

    const uploaded = new Set(
      (await this.storage.listUploadedParts(video, sessionId)).map((part) => part.partNumber),
    );
    const limit = Math.min(Math.max(input.limit ?? MAX_URLS_PER_REQUEST, 1), MAX_URLS_PER_REQUEST);
    const missing: number[] = [];
    for (let part = 1; part <= plan.partCount && missing.length < limit; part++) {
      if (!uploaded.has(part)) missing.push(part);
    }

    return {
      ...plan,
      uploadedPartNumbers: [...uploaded].sort((a, b) => a - b),
      urls: await this.storage.signPartUrls(video, sessionId, missing),
    };
  }
}
