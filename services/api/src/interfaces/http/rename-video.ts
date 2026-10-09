import { renameVideoRequestSchema } from '@cvp/shared';
import { renameVideo } from './container';
import { json, parseBody, pathParam, route, userIdOf } from './http';
import { toVideoResponse } from './video-response';

// PATCH /videos/{videoId}
export const handler = route(async (event) => {
  const { title } = parseBody(event, renameVideoRequestSchema);
  const video = await renameVideo.execute({
    userId: userIdOf(event),
    videoId: pathParam(event, 'videoId'),
    title,
  });
  return json(200, toVideoResponse(video));
});
