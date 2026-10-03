import { listMyVideos } from './container';
import { json, route, userIdOf } from './http';
import { toListVideosResponse } from './video-list-response';

// GET /videos
export const handler = route(async (event) => {
  const videos = await listMyVideos.execute({ userId: userIdOf(event) });
  return json(200, await toListVideosResponse(videos));
});
