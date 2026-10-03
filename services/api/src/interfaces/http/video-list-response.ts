import type { ListVideosResponse } from '@cvp/shared';
import { PLAYBACK_URL_TTL_MS } from '../../application/video/get-playback';
import type { Video } from '../../domain/video';
import { playbackSigner } from './container';
import { toVideoResponse } from './video-response';

/** A list of videos as clients see it, each ready one with a signed link to its poster. */
export async function toListVideosResponse(videos: Video[]): Promise<ListVideosResponse> {
  const expiresAt = new Date(Date.now() + PLAYBACK_URL_TTL_MS);
  return {
    videos: await Promise.all(
      videos.map(async (video) =>
        toVideoResponse(
          video,
          // Only a processed video has a poster to link to.
          video.uploadStatus === 'ready'
            ? (await playbackSigner.sign(video.id, expiresAt)).poster
            : null,
        ),
      ),
    ),
  };
}
