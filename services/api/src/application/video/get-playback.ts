import { canDelete, type Viewer } from '../../domain/moderation';
import type { MediaInfo, ModerationStatus } from '../../domain/video';
import type {
  BlockRepository,
  CategoryRepository,
  Clock,
  PlaybackUrls,
  PlaybackUrlSigner,
  VideoRepository,
} from '../ports';
import { NO_BLOCKS } from '../safety/defaults';
import { findWatchable } from './find-watchable';

// Long enough to watch a full concert with pauses without the link dying mid-way.
export const PLAYBACK_URL_TTL_MS = 6 * 60 * 60 * 1000;

export interface Playback extends PlaybackUrls, MediaInfo {
  title: string;
  moderationStatus: ModerationStatus;
  canDelete: boolean;
  /** The viewer uploaded it: they cannot report it or block themselves. */
  isMine: boolean;
  expiresAt: string;
}

export class GetPlayback {
  constructor(
    private readonly videos: VideoRepository,
    private readonly signer: PlaybackUrlSigner,
    private readonly now: Clock,
    private readonly categories: CategoryRepository,
    private readonly blocks: BlockRepository = NO_BLOCKS,
  ) {}

  /** A video the viewer may not see answers "not found", so its existence stays private. */
  async execute(input: { viewer: Viewer; videoId: string }): Promise<Playback> {
    const video = await findWatchable(
      { videos: this.videos, categories: this.categories, blocks: this.blocks },
      input,
    );
    const expiresAt = new Date(this.now().getTime() + PLAYBACK_URL_TTL_MS);
    return {
      ...(await this.signer.sign(video.id, expiresAt)),
      ...video.media,
      title: video.title,
      moderationStatus: video.moderationStatus,
      canDelete: canDelete(video, input.viewer),
      isMine: video.ownerId === input.viewer.userId,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
