import { DomainError } from '../../domain/errors';
import { canDelete, canView, type Viewer } from '../../domain/moderation';
import type { MediaInfo, ModerationStatus } from '../../domain/video';
import { NotFoundError } from '../errors';
import { isHiddenByBlock } from '../../domain/safety';
import type {
  BlockRepository,
  CategoryRepository,
  Clock,
  PlaybackUrls,
  PlaybackUrlSigner,
  VideoRepository,
} from '../ports';
import { blockedIdsOf, NO_BLOCKS } from '../safety/defaults';

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
    const video = await this.videos.findById(input.videoId);
    if (!video) throw new NotFoundError();
    // Other people reach a video only through its event, so that is what gets checked.
    const category = video.categoryId ? await this.categories.findById(video.categoryId) : null;
    if (!canView(video, input.viewer, category)) throw new NotFoundError();
    // Admins still open a blocked person's video, to review it.
    if (
      !input.viewer.isAdmin &&
      isHiddenByBlock(video, await blockedIdsOf(this.blocks, input.viewer.userId))
    ) {
      throw new NotFoundError();
    }
    if (video.uploadStatus !== 'ready' || video.media === null) {
      throw new DomainError('INVALID_STATE', `Video is ${video.uploadStatus}, not ready to play`);
    }
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
