import { listLibrary } from './container';
import { json, route, userIdOf } from './http';
import { toListVideosResponse } from './video-list-response';

// GET /library
export const handler = route(async (event) => {
  const videos = await listLibrary.execute({ userId: userIdOf(event) });
  return json(200, await toListVideosResponse(videos));
});
