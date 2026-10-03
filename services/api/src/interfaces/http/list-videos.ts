import type { ListVideosResponse } from '@cvp/shared';
import { PLAYBACK_URL_TTL_MS } from '../../application/video/get-playback';
import { listMyVideos, playbackSigner } from './container';
import { json, route, userIdOf } from './http';
import { toVideoResponse } from './video-response';

// GET /videos
export const handler = route(async (event) => {
  const videos = await listMyVideos.execute({ userId: userIdOf(event) });
  const expiresAt = new Date(Date.now() + PLAYBACK_URL_TTL_MS);
  const response: ListVideosResponse = {
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
  return json(200, response);
});
