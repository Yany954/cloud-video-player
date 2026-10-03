import { reviewVideoRequestSchema } from '@cvp/shared';
import { reviewVideo } from './container';
import { json, parseBody, pathParam, route, viewerOf } from './http';
import { toVideoResponse } from './video-response';

// POST /admin/videos/{videoId}/review
export const handler = route(async (event) => {
  const { decision } = parseBody(event, reviewVideoRequestSchema);
  const video = await reviewVideo.execute({
    reviewer: viewerOf(event),
    videoId: pathParam(event, 'videoId'),
    decision,
  });
  return json(200, toVideoResponse(video));
});
