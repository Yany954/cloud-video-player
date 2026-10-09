import { setVideoEventRequestSchema } from '@cvp/shared';
import { setVideoCategory } from './container';
import { json, parseBody, pathParam, route, userIdOf } from './http';
import { toVideoResponse } from './video-response';

// PUT /videos/{videoId}/event
export const handler = route(async (event) => {
  const { eventId } = parseBody(event, setVideoEventRequestSchema);
  const userId = userIdOf(event);
  const videoId = pathParam(event, 'videoId');
  const video = await setVideoCategory.execute({ userId, videoId, categoryId: eventId });
  // One line per change, so "who put this video in that event, and when" can be answered
  // later. Ids only: no titles or names.
  console.log(JSON.stringify({ action: 'SetVideoEvent', videoId, to: eventId, userId }));
  return json(200, toVideoResponse(video));
});
