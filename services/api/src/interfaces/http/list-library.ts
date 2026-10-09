import { listSharedWithMe } from './container';
import { json, route, viewerOf } from './http';
import { toListVideosResponse } from './video-list-response';

// GET /library ("Shared with me": videos of the events the caller belongs to)
export const handler = route(async (event) => {
  const videos = await listSharedWithMe.execute({ viewer: viewerOf(event) });
  return json(200, await toListVideosResponse(videos));
});
