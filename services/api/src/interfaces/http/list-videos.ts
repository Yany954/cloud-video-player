import type { ListVideosResponse } from '@cvp/shared';
import { listMyVideos } from './container';
import { json, route, userIdOf } from './http';
import { toVideoResponse } from './video-response';

// GET /videos
export const handler = route(async (event) => {
  const videos = await listMyVideos.execute({ userId: userIdOf(event) });
  return json(200, { videos: videos.map(toVideoResponse) } satisfies ListVideosResponse);
});
