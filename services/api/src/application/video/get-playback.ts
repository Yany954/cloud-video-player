import { DomainError } from '../../domain/errors';
import { canView, type Viewer } from '../../domain/moderation';
import type { MediaInfo, ModerationStatus } from '../../domain/video';
import { NotFoundError } from '../errors';
import type { Clock, PlaybackUrls, PlaybackUrlSigner, VideoRepository } from '../ports';

// Long enough to watch a full concert with pauses without the link dying mid-way.
export const PLAYBACK_URL_TTL_MS = 6 * 60 * 60 * 1000;

export interface Playback extends PlaybackUrls, MediaInfo {
  title: string;
  moderationStatus: ModerationStatus;
  expiresAt: string;
}

export class GetPlayback {
  constructor(
    private readonly videos: VideoRepository,
    private readonly signer: PlaybackUrlSigner,
    private readonly now: Clock,
  ) {}

  /** A video the viewer may not see answers "not found", so its existence stays private. */
  async execute(input: { viewer: Viewer; videoId: string }): Promise<Playback> {
    const video = await this.videos.findById(input.videoId);
    if (!video || !canView(video, input.viewer)) throw new NotFoundError();
    if (video.uploadStatus !== 'ready' || video.media === null) {
      throw new DomainError('INVALID_STATE', `Video is ${video.uploadStatus}, not ready to play`);
    }
    const expiresAt = new Date(this.now().getTime() + PLAYBACK_URL_TTL_MS);
    return {
      ...(await this.signer.sign(video.id, expiresAt)),
      ...video.media,
      title: video.title,
      moderationStatus: video.moderationStatus,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
