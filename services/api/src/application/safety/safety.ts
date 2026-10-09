import { removeCollaborator } from '../../domain/category';
import { canView, type Viewer } from '../../domain/moderation';
import {
  createBlock,
  createReport,
  flagVideo,
  type Block,
  type Report,
  type ReportReason,
} from '../../domain/safety';
import type { Video } from '../../domain/video';
import { MAX_LISTED_CATEGORIES } from '../category/categories';
import { ForbiddenError, NotFoundError } from '../errors';
import type {
  BlockRepository,
  CategoryRepository,
  Clock,
  ReportRepository,
  VideoRepository,
} from '../ports';
import { MAX_LISTED_VIDEOS } from '../video/list-my-videos';

/** A video the caller cannot see looks the same as one that does not exist. */
async function findVisible(
  videos: VideoRepository,
  categories: CategoryRepository,
  videoId: string,
  viewer: Viewer,
): Promise<Video> {
  const video = await videos.findById(videoId);
  if (!video) throw new NotFoundError();
  const category = video.categoryId ? await categories.findById(video.categoryId) : null;
  if (!canView(video, viewer, category)) throw new NotFoundError();
  return video;
}

export class ReportVideo {
  constructor(
    private readonly videos: VideoRepository,
    private readonly categories: CategoryRepository,
    private readonly reports: ReportRepository,
    private readonly now: Clock,
  ) {}

  /** Hides the video at once and sends it to the admins. Reporting twice changes nothing. */
  async execute(input: {
    viewer: Viewer;
    videoId: string;
    reason: ReportReason;
    note?: string;
  }): Promise<void> {
    const video = await findVisible(this.videos, this.categories, input.videoId, input.viewer);
    const report = createReport({
      video,
      reporterId: input.viewer.userId,
      reason: input.reason,
      note: input.note,
      now: this.now(),
    });
    if (!(await this.reports.add(report))) return;
    const flagged = flagVideo(video);
    if (flagged !== video) await this.videos.saveModeration(flagged);
  }
}

export class ListReviewQueueWithReports {
  constructor(
    private readonly videos: VideoRepository,
    private readonly reports: ReportRepository,
  ) {}

  /** Admins only. Each waiting video with the reports made against it, oldest video first. */
  async execute(input: { viewer: Viewer }): Promise<{ video: Video; reports: Report[] }[]> {
    if (!input.viewer.isAdmin) throw new ForbiddenError();
    const videos = await this.videos.listAwaitingReview(MAX_LISTED_VIDEOS);
    return Promise.all(
      videos.map(async (video) => ({ video, reports: await this.reports.listByVideo(video.id) })),
    );
  }
}

export class BlockUploader {
  constructor(
    private readonly videos: VideoRepository,
    private readonly categories: CategoryRepository,
    private readonly blocks: BlockRepository,
    private readonly now: Clock,
  ) {}

  /**
   * Blocks whoever uploaded a video the caller can see. Their videos disappear for the caller,
   * and they lose their place in the events the caller owns.
   */
  async execute(input: { viewer: Viewer; videoId: string }): Promise<Block> {
    const video = await findVisible(this.videos, this.categories, input.videoId, input.viewer);
    const block = createBlock({ video, blockerId: input.viewer.userId, now: this.now() });
    await this.blocks.add(block);

    const owned = await this.categories.listByOwner(block.blockerId, MAX_LISTED_CATEGORIES);
    for (const category of owned) {
      if (category.collaboratorIds.includes(block.blockedId)) {
        await this.categories.leave(removeCollaborator(category, block.blockedId), block.blockedId);
      }
    }
    return block;
  }
}

export class ListBlocks {
  constructor(private readonly blocks: BlockRepository) {}

  execute(input: { userId: string }): Promise<Block[]> {
    return this.blocks.listByBlocker(input.userId);
  }
}

export class Unblock {
  constructor(private readonly blocks: BlockRepository) {}

  /** Their videos show again. They do not get back into the caller's events by themselves. */
  execute(input: { userId: string; blockedId: string }): Promise<void> {
    return this.blocks.remove(input.userId, input.blockedId);
  }
}
