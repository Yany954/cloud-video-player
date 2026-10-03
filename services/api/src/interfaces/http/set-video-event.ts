import { setVideoEventRequestSchema } from '@cvp/shared';
import { setVideoCategory } from './container';
import { json, parseBody, pathParam, route, userIdOf } from './http';
import { toVideoResponse } from './video-response';

// PUT /videos/{videoId}/event
export const handler = route(async (event) => {
  const { eventId } = parseBody(event, setVideoEventRequestSchema);
  const video = await setVideoCategory.execute({
    userId: userIdOf(event),
    videoId: pathParam(event, 'videoId'),
    categoryId: eventId,
  });
  return json(200, toVideoResponse(video));
});
