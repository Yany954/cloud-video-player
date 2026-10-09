import type { Viewer } from '../../domain/moderation';
import { downloadFileName } from '../../domain/video';
import type {
  BlockRepository,
  CategoryRepository,
  Clock,
  ObjectStorage,
  VideoRepository,
} from '../ports';
import { NO_BLOCKS } from '../safety/defaults';
import { findWatchable } from './find-watchable';

// Only has to last until the browser starts the download; a download in progress continues.
export const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

export interface Download {
  url: string;
  fileName: string;
  expiresAt: string;
}

export class GetDownload {
  constructor(
    private readonly videos: VideoRepository,
    private readonly storage: ObjectStorage,
    private readonly now: Clock,
    private readonly categories: CategoryRepository,
    private readonly blocks: BlockRepository = NO_BLOCKS,
  ) {}

  /** Whoever may play a video may keep a copy of the playable version, and nobody else. */
  async execute(input: { viewer: Viewer; videoId: string }): Promise<Download> {
    const video = await findWatchable(
      { videos: this.videos, categories: this.categories, blocks: this.blocks },
      input,
    );
    const fileName = downloadFileName(video);
    return {
      url: await this.storage.signDownloadUrl(video, fileName, DOWNLOAD_URL_TTL_SECONDS),
      fileName,
      expiresAt: new Date(this.now().getTime() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }
}
