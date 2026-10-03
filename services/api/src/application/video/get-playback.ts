import { DomainError } from '../../domain/errors';
import type { MediaInfo } from '../../domain/video';
import type { Clock, PlaybackUrls, PlaybackUrlSigner, VideoRepository } from '../ports';
import { findOwnedVideo } from '../upload/owned-video';

// Long enough to watch a full concert with pauses without the link dying mid-way.
export const PLAYBACK_URL_TTL_MS = 6 * 60 * 60 * 1000;

export interface Playback extends PlaybackUrls, MediaInfo {
  title: string;
  expiresAt: string;
}

export class GetPlayback {
  constructor(
    private readonly videos: VideoRepository,
    private readonly signer: PlaybackUrlSigner,
    private readonly now: Clock,
  ) {}

  /** Owner only for now: other viewers arrive with moderation. */
  async execute(input: { userId: string; videoId: string }): Promise<Playback> {
    const video = await findOwnedVideo(this.videos, input.videoId, input.userId);
    if (video.uploadStatus !== 'ready' || video.media === null) {
      throw new DomainError('INVALID_STATE', `Video is ${video.uploadStatus}, not ready to play`);
    }
    const expiresAt = new Date(this.now().getTime() + PLAYBACK_URL_TTL_MS);
    return {
      ...(await this.signer.sign(video.id, expiresAt)),
      ...video.media,
      title: video.title,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
