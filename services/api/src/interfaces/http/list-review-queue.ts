import { listReviewQueue } from './container';
import { json, route, viewerOf } from './http';
import { toListVideosResponse } from './video-list-response';

// GET /admin/review
export const handler = route(async (event) => {
  const videos = await listReviewQueue.execute({ viewer: viewerOf(event) });
  return json(200, await toListVideosResponse(videos));
});
