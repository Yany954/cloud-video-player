import { completeUpload } from './container';
import { json, pathParam, route, userIdOf } from './http';
import { toVideoResponse } from './video-response';

// POST /uploads/{videoId}/complete
export const handler = route(async (event) => {
  const video = await completeUpload.execute({
    userId: userIdOf(event),
    videoId: pathParam(event, 'videoId'),
  });
  return json(200, toVideoResponse(video));
});
