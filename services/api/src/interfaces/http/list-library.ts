import { listLibrary } from './container';
import { json, route } from './http';
import { toListVideosResponse } from './video-list-response';

// GET /library
export const handler = route(async () => {
  return json(200, await toListVideosResponse(await listLibrary.execute()));
});
